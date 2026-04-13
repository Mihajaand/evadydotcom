/**
 * Supabase Edge Function - Créer un PaymentIntent Stripe
 * 
 * DÉPLOIEMENT:
 * 1. Installez Supabase CLI: npm i -g supabase
 * 2. Liez votre projet: supabase link --project-ref <votre-ref>
 * 3. Ajoutez les secrets:
 *    supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
 *    supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_xxx
 * 4. Déployez: supabase functions deploy create-payment-intent
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

// Clé secrète Stripe (stockée dans les secrets Supabase, JAMAIS en dur)
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

// Mapping des Product IDs Stripe pour chaque tier
const PRODUCT_IDS = {
  basic: 'prod_UKSA5byhwMvyNq',     // BASIC - 9,99€/mois
  premium: 'prod_UKSAffBD6qq8Q6',   // PREMIUM - 19,99€/mois
  vip: 'prod_UKSBmT4H0Q8BTT',       // VIP - 39,99€/mois
};

// Montants en centimes pour PaymentIntent (paiement unique)
const AMOUNTS = {
  basic: 999,     // 9,99€
  premium: 1999,  // 19,99€
  vip: 3999,      // 39,99€
};

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  // Répondre aux preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { tier, userId, email } = await req.json();

    // Validation des paramètres
    if (!tier || !userId) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants: tier et userId requis' }),
        { status: 400, headers }
      );
    }

    if (!AMOUNTS[tier]) {
      return new Response(
        JSON.stringify({ error: `Tier invalide: ${tier}. Utilisez basic, premium ou vip` }),
        { status: 400, headers }
      );
    }

    // Créer ou récupérer le client Stripe
    let customer;
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
    }

    // Créer un PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: AMOUNTS[tier],
      currency: 'eur',
      customer: customer.id,
      metadata: {
        supabase_user_id: userId,
        tier,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Créer une clé éphémère pour le Payment Sheet
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2023-10-16' }
    );

    // Retourner les infos nécessaires au Payment Sheet côté mobile
    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Erreur Stripe:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
