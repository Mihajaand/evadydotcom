// ============================================================
// E-VADY — Edge Function : Confirmation de paiement
// Appelée par Stripe après paiement réussi (success_url)
// Met à jour l'abonnement dans Supabase
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    const userId = url.searchParams.get('user_id');
    const plan = url.searchParams.get('plan');

    if (!sessionId || !userId || !plan) {
      throw new Error('Paramètres manquants');
    }

    // ---- Vérifier la session Stripe ----
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        },
      }
    );
    const session = await stripeResponse.json();

    // Vérifier que le paiement est bien confirmé
    if (session.payment_status !== 'paid') {
      throw new Error('Paiement non confirmé');
    }

    // ---- Mettre à jour l'abonnement dans Supabase ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculer la date d'expiration (30 jours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Upsert l'abonnement
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        tier: plan,
        stripe_session_id: sessionId,
        stripe_subscription_id: session.subscription || null,
        stripe_sub_id: session.subscription || null,
        expires_at: expiresAt.toISOString(),
        cancel_at_period_end: false,
      }, {
        onConflict: 'user_id',
      });

    if (subError) {
      console.error('Erreur upsert subscription:', subError);
    }

    // ---- Rediriger directement vers l'application via Deep Link (HTTP 302) ----
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `evady://payment-success?session_id=${sessionId}&user_id=${userId}&plan=${plan}`,
      },
    });
  } catch (error) {
    console.error('Erreur payment-success:', error);
    return new Response(
      `<html><body><h1>Erreur</h1><p>${error.message}</p></body></html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 400,
      }
    );
  }
});