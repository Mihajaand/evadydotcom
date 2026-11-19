import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  appleRequest,
  BUNDLE_ID,
  createAppleToken,
  decodeSignedPayload,
  PRODUCT_TIERS,
} from '../_shared/appStoreServer.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Méthode non autorisée.' }, { status: 405 });
  }

  try {
    const authorization = req.headers.get('Authorization');
    const accessToken = authorization?.replace(/^Bearer\s+/i, '');
    if (!accessToken) return Response.json({ error: 'Authentification requise.' }, { status: 401 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Configuration Supabase serveur incomplète.');
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return Response.json({ error: 'Session utilisateur invalide.' }, { status: 401 });

    const {
      transactionId,
      productId,
      isRestore = false,
      preflightOnly = false,
    } = await req.json();
    if (
      typeof transactionId !== 'string' ||
      !/^\d+$/.test(transactionId) ||
      typeof productId !== 'string' ||
      !PRODUCT_TIERS[productId]
    ) {
      return Response.json({ error: 'Transaction ou produit App Store invalide.' }, { status: 400 });
    }

    const appleToken = await createAppleToken();
    const transactionResponse = await appleRequest(
      `/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      appleToken
    );
    if (!transactionResponse.ok) {
      console.error('Échec de vérification Apple:', transactionResponse.status, await transactionResponse.text());
      return Response.json({ error: 'Apple n’a pas pu vérifier cette transaction.' }, { status: 400 });
    }

    const transactionResult = await transactionResponse.json();
    const transaction = decodeSignedPayload<{
      appAccountToken?: string;
      bundleId?: string;
      expiresDate?: number;
      originalTransactionId?: string;
      purchaseDate?: number;
      productId?: string;
      revocationDate?: number;
      transactionId?: string;
      environment?: string;
    }>(transactionResult.signedTransactionInfo);

    if (
      transaction.transactionId !== transactionId ||
      transaction.productId !== productId ||
      transaction.bundleId !== BUNDLE_ID ||
      !transaction.originalTransactionId ||
      !['Production', 'Sandbox'].includes(transaction.environment || '')
    ) {
      return Response.json({ error: 'Les informations de cette transaction ne correspondent pas à l’application.' }, { status: 403 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: owner, error: ownerError } = await admin
      .from('subscriptions')
      .select('user_id, payment_provider')
      .eq('apple_original_transaction_id', transaction.originalTransactionId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (owner && owner.user_id !== user.id) {
      return Response.json({
        error: 'Cet abonnement Apple actif est déjà lié à un autre compte E-VADY. Apple ne permet pas de facturer deux abonnements séparés avec le même compte Sandbox dans ce groupe. Utilisez le compte E-VADY d’origine ou un autre testeur Sandbox.',
      }, { status: 409 });
    }
    if (
      transaction.appAccountToken &&
      transaction.appAccountToken.toLowerCase() !== user.id.toLowerCase() &&
      owner?.user_id !== user.id
    ) {
      return Response.json({
        error: 'Cet achat Apple est lié à un autre compte E-VADY. Reconnectez-vous au compte d’origine ou utilisez un autre testeur Sandbox.',
      }, { status: 403 });
    }
    if (!transaction.appAccountToken && !isRestore && !preflightOnly && owner?.user_id !== user.id) {
      return Response.json({ error: 'Le compte App Store n’est pas associé à ce compte utilisateur.' }, { status: 403 });
    }
    if (preflightOnly) {
      return Response.json({ preflight: true, canPurchase: true });
    }

    const { error: purchasedTransactionError } = await admin
      .from('app_store_transactions')
      .upsert({
        user_id: user.id,
        transaction_id: transaction.transactionId,
        original_transaction_id: transaction.originalTransactionId,
        product_id: transaction.productId,
        tier: PRODUCT_TIERS[transaction.productId],
        environment: transaction.environment,
        verification_status: 'verified',
        status: transaction.revocationDate
          ? 'revoked'
          : transaction.expiresDate && transaction.expiresDate > Date.now()
          ? 'active'
          : 'expired',
        event_type: isRestore ? 'RESTORE' : 'PURCHASE',
        transaction_date: transaction.purchaseDate
          ? new Date(transaction.purchaseDate).toISOString()
          : null,
        expires_at: transaction.expiresDate
          ? new Date(transaction.expiresDate).toISOString()
          : null,
      }, { onConflict: 'environment,transaction_id' });
    if (purchasedTransactionError) throw purchasedTransactionError;

    const { data: existing, error: existingError } = await admin
      .from('subscriptions')
      .select('payment_provider, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    const existingIsActive = existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now();
    if (
      existingIsActive &&
      existing.payment_provider &&
      existing.payment_provider !== 'app_store' &&
      existing.payment_provider !== 'stripe'
    ) {
      return Response.json({ error: 'Un autre fournisseur de paiement est déjà associé au compte.' }, { status: 409 });
    }
    if (existingIsActive && existing.payment_provider === 'stripe') {
      return Response.json({ error: 'Un abonnement Stripe est déjà actif sur ce compte.' }, { status: 409 });
    }

    const statusResponse = await appleRequest(
      `/inApps/v1/subscriptions/${encodeURIComponent(transaction.originalTransactionId)}`,
      appleToken
    );
    let latestTransaction = transaction;
    let cancelAtPeriodEnd = false;
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      const latestRecord = (statusResult.data || [])
        .flatMap((group: { lastTransactions?: Array<Record<string, string>> }) => group.lastTransactions || [])
        .find((record: Record<string, string>) => record.originalTransactionId === transaction.originalTransactionId);
      if (latestRecord?.signedTransactionInfo) {
        latestTransaction = decodeSignedPayload(latestRecord.signedTransactionInfo);
      }
      if (latestRecord?.signedRenewalInfo) {
        const renewal = decodeSignedPayload<{ autoRenewStatus?: number }>(latestRecord.signedRenewalInfo);
        cancelAtPeriodEnd = renewal.autoRenewStatus === 0;
      }
    } else {
      console.error('Impossible de récupérer le statut de renouvellement Apple:', statusResponse.status);
    }

    const latestProductId = latestTransaction.productId;
    const tier = latestProductId ? PRODUCT_TIERS[latestProductId] : undefined;
    if (
      latestTransaction.bundleId !== BUNDLE_ID ||
      !latestProductId ||
      !tier ||
      !['Production', 'Sandbox'].includes(latestTransaction.environment || '') ||
      (latestTransaction.appAccountToken &&
        latestTransaction.appAccountToken.toLowerCase() !== user.id.toLowerCase() &&
        owner?.user_id !== user.id)
    ) {
      return Response.json({ error: 'Le statut de l’abonnement Apple ne correspond pas au compte.' }, { status: 403 });
    }

    const expiresAt = latestTransaction.expiresDate
      ? new Date(latestTransaction.expiresDate).toISOString()
      : null;
    const active = !latestTransaction.revocationDate && expiresAt && new Date(expiresAt).getTime() > Date.now();
    if (!active) {
      if (owner?.user_id === user.id) {
        const { error: updateError } = await admin
          .from('subscriptions')
          .update({
            tier: 'free',
            cancel_at_period_end: false,
          })
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      }
      const { error: transactionError } = await admin
        .from('app_store_transactions')
        .upsert({
          user_id: user.id,
          transaction_id: latestTransaction.transactionId || transactionId,
          original_transaction_id: transaction.originalTransactionId,
          product_id: latestProductId,
          tier,
          environment: latestTransaction.environment,
          verification_status: 'verified',
          status: latestTransaction.revocationDate ? 'revoked' : 'expired',
          event_type: isRestore ? 'RESTORE' : 'PURCHASE',
          transaction_date: latestTransaction.purchaseDate
            ? new Date(latestTransaction.purchaseDate).toISOString()
            : null,
          expires_at: expiresAt,
        }, { onConflict: 'environment,transaction_id' });
      if (transactionError) throw transactionError;
      return Response.json({ active: false, error: 'Cet abonnement Apple n’est plus actif.' });
    }

    const { error: transactionError } = await admin
      .from('app_store_transactions')
      .upsert({
        user_id: user.id,
        transaction_id: latestTransaction.transactionId || transactionId,
        original_transaction_id: transaction.originalTransactionId,
        product_id: latestProductId,
        tier,
        environment: latestTransaction.environment,
        verification_status: 'verified',
        status: 'active',
        event_type: isRestore ? 'RESTORE' : 'PURCHASE',
        transaction_date: latestTransaction.purchaseDate
          ? new Date(latestTransaction.purchaseDate).toISOString()
          : null,
        expires_at: expiresAt,
      }, { onConflict: 'environment,transaction_id' });
    if (transactionError) throw transactionError;

    const { data: subscription, error: upsertError } = await admin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        tier,
        payment_provider: 'app_store',
        apple_original_transaction_id: transaction.originalTransactionId,
        apple_transaction_id: latestTransaction.transactionId || transactionId,
        apple_product_id: latestProductId,
        app_store_environment: latestTransaction.environment,
        expires_at: expiresAt,
        cancel_at_period_end: cancelAtPeriodEnd,
        stripe_sub_id: null,
        stripe_subscription_id: null,
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (upsertError) throw upsertError;

    return Response.json({ active: true, subscription });
  } catch (error) {
    console.error('Erreur vérification abonnement Apple:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur lors de la vérification Apple.' },
      { status: 500 }
    );
  }
});
