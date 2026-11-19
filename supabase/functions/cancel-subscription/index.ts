import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Méthode non autorisée.' }, { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      throw new Error('Configuration Supabase serveur incomplète.');
    }
    if (!accessToken) {
      return Response.json({ error: 'Authentification requise.' }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !user) {
      return Response.json({ error: 'Session utilisateur invalide.' }, { status: 401, headers: corsHeaders });
    }

    const { userId: requestedUserId } = await req.json();
    if (requestedUserId && requestedUserId !== user.id) {
      return Response.json({ error: 'Le compte ne correspond pas à la session active.' }, { status: 403, headers: corsHeaders });
    }
    const userId = user.id;

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(supabaseUrl, serviceKey);

    // Récupérer l'abonnement du user dans la base de données
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError?.code === 'PGRST116') {
      return Response.json({ error: 'Aucun abonnement trouvé pour cet utilisateur.' }, { status: 404, headers: corsHeaders });
    }
    if (fetchError) throw fetchError;
    if (!subscription) {
      return Response.json({ error: 'Aucun abonnement trouvé pour cet utilisateur.' }, { status: 404, headers: corsHeaders });
    }
    if (subscription.payment_provider === 'app_store') {
      return Response.json({ error: 'Cet abonnement est géré par Apple, pas par Stripe.' }, { status: 409, headers: corsHeaders });
    }

    const subId = subscription.stripe_subscription_id || subscription.stripe_sub_id;
    if (!subId) {
      return Response.json({ error: "Aucun ID d'abonnement Stripe n'est associé à ce compte." }, { status: 409, headers: corsHeaders });
    }

    // Annuler l'abonnement Stripe à la fin de la période
    await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    // Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    return Response.json(
      { success: true, message: 'Le renouvellement automatique a été désactivé.' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Erreur annulation abonnement:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur lors de l’annulation.' },
      { status: 500, headers: corsHeaders }
    );
  }
});
