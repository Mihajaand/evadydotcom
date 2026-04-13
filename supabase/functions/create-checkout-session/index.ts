// ============================================================
// E-VADY — Edge Function : Créer une Stripe Checkout Session
// Redirige l'utilisateur vers la page de paiement Stripe hébergée
// Compatible Expo Go (pas besoin de SDK natif)
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ---- En-têtes CORS ----
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Gérer le preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }

    // ---- Récupérer les données de la requête ----
    const { plan, userId, email } = await req.json();

    // ---- Mapping plan → Price ID Stripe ----
    const priceMap: Record<string, string> = {
      basic: 'price_1TLnFuLkP8GG04LfXhR35NfK',     // 9,99€/mois
      premium: 'price_1TLnGNLkP8GG04LfpoacCx7V',    // 19,99€/mois
      vip: 'price_1TLnGqLkP8GG04LfCNnic9yA',        // 39,99€/mois
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      throw new Error(`Plan "${plan}" invalide.`);
    }

    // ---- Créer la Checkout Session via l'API REST Stripe ----
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[0]', 'card');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `https://xsmltvqontirppmyyfkh.supabase.co/functions/v1/payment-success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&plan=${plan}`);
    params.append('cancel_url', 'https://evady.app/payment-cancelled');
    params.append('client_reference_id', userId);
    params.append('metadata[user_id]', userId);
    params.append('metadata[plan]', plan);

    // Si on a l'email, pré-remplir le formulaire Stripe
    if (email) {
      params.append('customer_email', email);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeResponse.json();

    if (session.error) {
      throw new Error(session.error.message);
    }

    // ---- Retourner l'URL de checkout ----
    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    // ---- Gestion des erreurs ----
    console.error('Erreur Checkout Session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});