import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const productTiers: Record<string, string> = {
  evady_basic_monthly: 'basic',
  evady_premium_monthly: 'premium',
  evady_vip_monthly: 'vip',
};

type RevenueCatEvent = {
  app_user_id?: string;
  cancel_reason?: string | null;
  expiration_at_ms?: number | null;
  original_transaction_id?: string | null;
  product_id?: string | null;
  type?: string;
};

serve(async (req: Request) => {
  const webhookAuthorization = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (!webhookAuthorization) {
    console.error('REVENUECAT_WEBHOOK_AUTHORIZATION non configurée');
    return new Response('Webhook non configuré', { status: 500 });
  }
  if (req.headers.get('authorization') !== webhookAuthorization) {
    return new Response('Non autorisé', { status: 401 });
  }

  try {
    const payload = await req.json();
    const event = payload?.event as RevenueCatEvent | undefined;
    if (!event?.app_user_id || !event.type) {
      return new Response('Événement RevenueCat invalide', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = event.app_user_id;
    const productId = event.product_id || null;
    const tier = productId ? productTiers[productId] : null;
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

    if (['INITIAL_PURCHASE', 'RENEWAL'].includes(event.type)) {
      if (!tier || !expiresAt) {
        throw new Error(`Produit ou échéance App Store non reconnu: ${productId}`);
      }

      const { error } = await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          tier,
          payment_provider: 'app_store',
          revenuecat_product_id: productId,
          revenuecat_original_transaction_id: event.original_transaction_id || null,
          expires_at: expiresAt,
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    } else if (event.type === 'CANCELLATION' && event.cancel_reason === 'UNSUBSCRIBE') {
      const cancellationUpdates = {
        payment_provider: 'app_store',
        revenuecat_product_id: productId,
        revenuecat_original_transaction_id: event.original_transaction_id || null,
        cancel_at_period_end: true,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      };
      const { error } = await supabase
        .from('subscriptions')
        .update(cancellationUpdates)
        .eq('user_id', userId)
        .eq('payment_provider', 'app_store');
      if (error) throw error;
    } else if (event.type === 'UNCANCELLATION') {
      const { error } = await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: false })
        .eq('user_id', userId)
        .eq('payment_provider', 'app_store');
      if (error) throw error;
    } else if (event.type === 'EXPIRATION') {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: 'free',
          payment_provider: 'app_store',
          revenuecat_product_id: productId,
          revenuecat_original_transaction_id: event.original_transaction_id || null,
          expires_at: null,
          cancel_at_period_end: false,
        })
        .eq('user_id', userId)
        .eq('payment_provider', 'app_store');
      if (error) throw error;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erreur webhook RevenueCat:', error);
    return new Response('Erreur webhook', { status: 500 });
  }
});
