import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUNDLE_ID = Deno.env.get('APP_STORE_BUNDLE_ID') || 'com.mihajamahefa.evady';
const PRODUCT_TIERS: Record<string, string> = {
  basic: 'basic',
  premium_abo: 'premium',
  evady_vip_monthly: 'vip',
};

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const decodeSignedPayload = <T>(signedPayload: string): T => {
  const payload = signedPayload.split('.')[1];
  if (!payload) throw new Error('Réponse signée App Store invalide.');
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as T;
};

const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const createAppleToken = async (): Promise<string> => {
  const issuerId = Deno.env.get('APP_STORE_ISSUER_ID');
  const keyId = Deno.env.get('APP_STORE_KEY_ID');
  const privateKey = Deno.env.get('APP_STORE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!issuerId || !keyId || !privateKey) {
    throw new Error('Les identifiants API App Store ne sont pas configurés côté serveur.');
  }

  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64Url(pem.replace(/\+/g, '-').replace(/\//g, '_')),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })));
  const claims = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  })));
  const message = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    new TextEncoder().encode(message)
  );
  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`;
};

const appleRequest = async (path: string, token: string): Promise<Response> => {
  const productionUrl = `https://api.storekit.itunes.apple.com${path}`;
  const production = await fetch(productionUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (production.status !== 404) return production;
  return fetch(`https://api.storekit-sandbox.itunes.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

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

    const { transactionId, productId, isRestore = false } = await req.json();
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
      productId?: string;
      revocationDate?: number;
      transactionId?: string;
    }>(transactionResult.signedTransactionInfo);

    if (
      transaction.transactionId !== transactionId ||
      transaction.productId !== productId ||
      transaction.bundleId !== BUNDLE_ID ||
      !transaction.originalTransactionId
    ) {
      return Response.json({ error: 'Les informations de cette transaction ne correspondent pas à l’application.' }, { status: 403 });
    }

    if (transaction.appAccountToken && transaction.appAccountToken.toLowerCase() !== user.id.toLowerCase()) {
      return Response.json({ error: 'Cet achat est associé à un autre compte utilisateur.' }, { status: 403 });
    }
    if (!transaction.appAccountToken && !isRestore) {
      return Response.json({ error: 'Le compte App Store n’est pas associé à ce compte utilisateur.' }, { status: 403 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: owner, error: ownerError } = await admin
      .from('subscriptions')
      .select('user_id, payment_provider')
      .eq('apple_original_transaction_id', transaction.originalTransactionId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (owner && owner.user_id !== user.id) {
      return Response.json({ error: 'Cet abonnement Apple est déjà associé à un autre compte E-VADY.' }, { status: 409 });
    }

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
      (latestTransaction.appAccountToken &&
        latestTransaction.appAccountToken.toLowerCase() !== user.id.toLowerCase())
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
            payment_provider: null,
            apple_original_transaction_id: null,
            apple_transaction_id: null,
            apple_product_id: null,
            expires_at: null,
            cancel_at_period_end: false,
          })
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      }
      return Response.json({ active: false, error: 'Cet abonnement Apple n’est plus actif.' });
    }

    const { data: subscription, error: upsertError } = await admin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        tier,
        payment_provider: 'app_store',
        apple_original_transaction_id: transaction.originalTransactionId,
        apple_transaction_id: latestTransaction.transactionId || transactionId,
        apple_product_id: latestProductId,
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
