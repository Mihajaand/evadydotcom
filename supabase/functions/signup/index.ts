/**
 * Supabase Edge Function - Inscription utilisateur
 * Utilise le service_role key pour bypasser les rate limits auth
 * Crée le user + profil + abonnement gratuit en une seule requête
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurée');
    }

    // Client admin avec service_role (bypass rate limits + RLS)
    const supabaseAdmin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, password, fullName, gender, birthdate, latitude, longitude } = await req.json();

    // Validation
    if (!email || !password || !fullName || !gender || !birthdate) {
      return new Response(
        JSON.stringify({ error: 'Champs requis: email, password, fullName, gender, birthdate' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Créer le user auth via admin API (bypass rate limit)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirmer l'email
    });

    if (authError) {
      // Gérer les erreurs courantes
      const msg = authError.message.includes('already been registered')
        ? 'Un compte existe déjà avec cet email'
        : authError.message;
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: corsHeaders }
      );
    }

    const userId = userData.user.id;

    // 2. Créer le profil via la fonction SECURITY DEFINER existante
    const { error: rpcError } = await supabaseAdmin.rpc('create_profile', {
      user_id: userId,
      user_gender: gender,
      user_full_name: fullName,
      user_birthdate: birthdate,
      user_latitude: latitude || 0,
      user_longitude: longitude || 0,
    });

    if (rpcError) {
      // Rollback : supprimer le user auth si le profil échoue
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw rpcError;
    }

    return new Response(
      JSON.stringify({ user: userData.user }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
