/**
 * Supabase Edge Function — Set Maintenance Mode
 * Utilise le service_role key pour bypasser les RLS policies
 * Met à jour la clé `maintenance_mode` dans `app_settings`
 * 
 * POST /functions/v1/set-maintenance
 * Body: { enabled: boolean }
 * Returns: { success: boolean, maintenance_mode: boolean }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  // Gérer les requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurée');
    }

    // Client admin avec service_role (bypass RLS policies)
    const supabaseAdmin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parser le corps de la requête
    const { enabled } = await req.json();

    // Validation
    if (typeof enabled !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Paramètre requis: enabled (boolean)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Mettre à jour la clé `maintenance_mode` dans `app_settings`
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert(
        [{ key: 'maintenance_mode', value: enabled ? 'true' : 'false' }],
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Erreur mise à jour maintenance_mode:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        maintenance_mode: enabled,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Edge Function error:', err.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Erreur interne serveur',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
