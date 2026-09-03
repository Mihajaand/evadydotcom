import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno&no-check';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature || !endpointSecret) {
    return new Response('Webhook secret ou signature manquante', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;

      const rawSub = invoice.subscription;
      const subscriptionId = typeof rawSub === 'string' ? rawSub : rawSub?.id;

      if (!subscriptionId) {
        console.log('Facture payée sans ID de souscription valide. Événement ignoré.');
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const lineItem = invoice.lines?.data?.[0];
      const periodEnd = lineItem?.period?.end
        ? new Date(lineItem.period.end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.userId;

      if (userId) {
        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            expires_at: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          });
      } else if (customerId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            expires_at: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_customer_id', customerId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

      if (userId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            tier: 'free',
            cancel_at_period_end: false,
          })
          .eq('user_id', userId);
      } else if (customerId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            tier: 'free',
            cancel_at_period_end: false,
          })
          .eq('stripe_customer_id', customerId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error(`Erreur Webhook: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});