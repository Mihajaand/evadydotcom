import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  appleRequest,
  BUNDLE_ID,
  createAppleToken,
  decodeSignedPayload,
  PRODUCT_TIERS,
} from '../_shared/appStoreServer.ts';

type AppleTransaction = {
  appAccountToken?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number;
  revocationDate?: number;
  transactionId?: string;
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Méthode non autorisée.' }, { status: 405 });
  }

  try {
    const expectedSecret = Deno.env.get('APP_STORE_NOTIFICATION_SECRET');
    const suppliedSecret = new URL(req.url).searchParams.get('secret');
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return Response.json({ error: 'Authentification de notification invalide.' }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Configuration Supabase serveur incomplète.');
    }

    const { signedPayload } = await req.json();
    if (typeof signedPayload !== 'string') {
      return Response.json({ error: 'Notification App Store invalide.' }, { status: 400 });
    }

    // La notification sert uniquement à retrouver la transaction; les données retenues sont relues via l’API Apple authentifiée.
    const notification = decodeSignedPayload<{
      notificationType?: string;
      subtype?: string;
      data?: { signedTransactionInfo?: string };
    }>(signedPayload);
    if (!notification.data?.signedTransactionInfo) {
      return Response.json({ received: true, skipped: true });
    }

    const announcedTransaction = decodeSignedPayload<AppleTransaction>(
      notification.data.signedTransactionInfo
    );
    const transactionId = announcedTransaction.transactionId;
    const originalTransactionId = announcedTransaction.originalTransactionId;
    if (
      !transactionId ||
      !/^\d+$/.test(transactionId) ||
      !originalTransactionId ||
      !/^\d+$/.test(originalTransactionId)
    ) {
      return Response.json({ error: 'Identifiants de transaction App Store invalides.' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: owner, error: ownerError } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('apple_original_transaction_id', originalTransactionId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) {
      return Response.json({ received: true, skipped: true, reason: 'Abonnement pas encore associé.' });
    }

    const appleToken = await createAppleToken();
    const transactionResponse = await appleRequest(
      `/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      appleToken
    );
    if (!transactionResponse.ok) {
      throw new Error(`Apple n’a pas confirmé la transaction (${transactionResponse.status}).`);
    }
    const transactionResult = await transactionResponse.json();
    const transaction = decodeSignedPayload<AppleTransaction>(transactionResult.signedTransactionInfo);
    const tier = transaction.productId ? PRODUCT_TIERS[transaction.productId] : undefined;
    if (
      transaction.transactionId !== transactionId ||
      transaction.originalTransactionId !== originalTransactionId ||
      transaction.bundleId !== BUNDLE_ID ||
      !tier ||
      !['Production', 'Sandbox'].includes(transaction.environment || '') ||
      (transaction.appAccountToken &&
        transaction.appAccountToken.toLowerCase() !== owner.user_id.toLowerCase())
    ) {
      return Response.json({ error: 'La transaction vérifiée ne correspond pas à cet abonnement.' }, { status: 403 });
    }

    const { error: transactionError } = await admin
      .from('app_store_transactions')
      .upsert({
        user_id: owner.user_id,
        transaction_id: transaction.transactionId,
        original_transaction_id: transaction.originalTransactionId,
        product_id: transaction.productId,
        tier,
        environment: transaction.environment,
        verification_status: 'verified',
        event_type: notification.notificationType || 'UNKNOWN',
        event_subtype: notification.subtype || null,
        status: transaction.revocationDate
          ? 'revoked'
          : transaction.expiresDate && transaction.expiresDate <= Date.now()
          ? 'expired'
          : 'active',
        transaction_date: transaction.purchaseDate
          ? new Date(transaction.purchaseDate).toISOString()
          : null,
        expires_at: transaction.expiresDate
          ? new Date(transaction.expiresDate).toISOString()
          : null,
      }, { onConflict: 'environment,transaction_id' });
    if (transactionError) throw transactionError;

    const statusResponse = await appleRequest(
      `/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
      appleToken
    );
    if (!statusResponse.ok) {
      throw new Error(`Apple n’a pas retourné l’état de l’abonnement (${statusResponse.status}).`);
    }

    const statusResult = await statusResponse.json();
    const latestRecord = (statusResult.data || [])
      .flatMap((group: { lastTransactions?: Array<Record<string, string>> }) => group.lastTransactions || [])
      .find((record: Record<string, string>) => record.originalTransactionId === originalTransactionId);
    if (!latestRecord?.signedTransactionInfo) {
      throw new Error('Apple n’a retourné aucune transaction récente pour cet abonnement.');
    }

    const latest = decodeSignedPayload<AppleTransaction>(latestRecord.signedTransactionInfo);
    const latestTier = latest.productId ? PRODUCT_TIERS[latest.productId] : undefined;
    if (
      latest.originalTransactionId !== originalTransactionId ||
      latest.bundleId !== BUNDLE_ID ||
      !latestTier ||
      latest.environment !== transaction.environment ||
      (latest.appAccountToken && latest.appAccountToken.toLowerCase() !== owner.user_id.toLowerCase())
    ) {
      throw new Error('Le dernier état Apple ne correspond pas à l’abonnement enregistré.');
    }

    const expiresAt = latest.expiresDate ? new Date(latest.expiresDate).toISOString() : null;
    const active = !latest.revocationDate && expiresAt && new Date(expiresAt).getTime() > Date.now();
    let cancelAtPeriodEnd = false;
    if (latestRecord.signedRenewalInfo) {
      const renewal = decodeSignedPayload<{ autoRenewStatus?: number }>(latestRecord.signedRenewalInfo);
      cancelAtPeriodEnd = renewal.autoRenewStatus === 0;
    }

    const { data: current, error: currentError } = await admin
      .from('subscriptions')
      .select('payment_provider, expires_at')
      .eq('user_id', owner.user_id)
      .maybeSingle();
    if (currentError) throw currentError;
    const stripeIsActive = current?.payment_provider === 'stripe' &&
      current.expires_at && new Date(current.expires_at).getTime() > Date.now();
    if (stripeIsActive) {
      return Response.json({ received: true, skipped: true, reason: 'Abonnement Stripe actif.' });
    }

    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        tier: active ? latestTier : 'free',
        payment_provider: 'app_store',
        apple_original_transaction_id: originalTransactionId,
        apple_transaction_id: latest.transactionId || transactionId,
        apple_product_id: latest.productId,
        app_store_environment: latest.environment,
        expires_at: expiresAt,
        cancel_at_period_end: active ? cancelAtPeriodEnd : false,
        stripe_sub_id: null,
        stripe_subscription_id: null,
      })
      .eq('user_id', owner.user_id);
    if (updateError) throw updateError;

    return Response.json({ received: true, updated: true, notificationType: notification.notificationType });
  } catch (error) {
    console.error('Erreur notification App Store:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur notification App Store.' },
      { status: 500 }
    );
  }
});
