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
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (subError) {
      console.error('Erreur upsert subscription:', subError);
    }

    // ---- Page HTML de confirmation ----
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>E-VADY — Paiement réussi</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #F13E93, #5DD3B6);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .check { font-size: 60px; margin-bottom: 16px; }
        h1 { color: #333; font-size: 24px; margin-bottom: 8px; }
        p { color: #666; font-size: 16px; line-height: 1.5; }
        .plan {
          display: inline-block;
          background: #F13E93;
          color: white;
          padding: 6px 20px;
          border-radius: 20px;
          font-weight: bold;
          margin: 16px 0;
          text-transform: uppercase;
        }
        .info { color: #999; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">✅</div>
        <h1>Paiement réussi !</h1>
        <div class="plan">${plan.toUpperCase()}</div>
        <p>Votre abonnement E-VADY est maintenant actif.</p>
        <p class="info">Vous pouvez fermer cette page et retourner dans l'application.</p>
      </div>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 200,
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