// ============================================================
// E-VADY — Edge Function : Créer une Stripe Checkout Session
// Redirige l'utilisateur vers la page de paiement Stripe hébergée
// Compatible Web et App Mobile (Expo)
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

    if (!userId) {
      throw new Error('userId est obligatoire');
    }

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

    // ---- Détection de l'origine (Web vs App Mobile) ----
    const originHeader = req.headers.get('origin') || req.headers.get('referer');
    let successUrl: string;
    let cancelUrl: string;

    if (originHeader && (originHeader.startsWith('http://') || originHeader.startsWith('https://'))) {
      // 🌐 Si la requête vient du Web (Ex: http://localhost:19006 ou https://votre-site.com)
      const baseUrl = new URL(originHeader).origin;
      successUrl = `${baseUrl}/subscription?success=true`;
      cancelUrl = `${baseUrl}/subscription`;
    } else {
      // 📱 Si la requête vient de l'application Mobile Expo
      successUrl = `https://xsmltvqontirppmyyfkh.supabase.co/functions/v1/payment-success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&plan=${plan}`;
      cancelUrl = `evady://payment-cancelled`;
    }

    // ---- Créer la Checkout Session via l'API REST Stripe ----
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[0]', 'card');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    
    // Configurer les URLs de retour
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    
    // Métadonnées indispensables pour le Webhook Stripe (Mise à jour automatique)
    params.append('client_reference_id', userId);
    params.append('metadata[userId]', userId);
    params.append('metadata[plan]', plan);
    params.append('subscription_data[metadata][userId]', userId);
    params.append('subscription_data[metadata][plan]', plan);

    // Pré-remplir l'email si présent
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
  } catch (error: any) {
    // ---- Gestion des erreurs ----
    console.error('Erreur Checkout Session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Une erreur est survenue' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});