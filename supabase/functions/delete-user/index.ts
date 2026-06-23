/**
 * Supabase Edge Function - Suppression complète d'un utilisateur
 * Supprime toutes les données liées à un utilisateur et supprime l'utilisateur Auth.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const extractStoragePath = (url: string) => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/');
    const index = segments.findIndex((segment) => segment === 'photos');
    if (index >= 0) {
      return segments.slice(index + 1).join('/');
    }
    return null;
  } catch (_err) {
    return null;
  }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non configuré');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json();
    const userId = payload?.user_id || payload?.userId;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    await supabaseAdmin.from('notifications').delete().or(`user_id.eq.${userId},notifier_id.eq.${userId}`);
    await supabaseAdmin.from('reports').delete().or(`reporter_id.eq.${userId},reported_id.eq.${userId}`);
    await supabaseAdmin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    await supabaseAdmin.from('likes').delete().or(`liker_id.eq.${userId},liked_id.eq.${userId}`);
    await supabaseAdmin.from('passes').delete().or(`passer_id.eq.${userId},passed_id.eq.${userId}`);
    await supabaseAdmin.from('daily_message_counts').delete().eq('user_id', userId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);

    const { data: photosData } = await supabaseAdmin.from('photos').select('url').eq('user_id', userId);
    const photoPaths = (photosData || [])
      .map((photo: { url?: string }) => photo.url && extractStoragePath(photo.url))
      .filter(Boolean);

    if (photoPaths.length > 0) {
      await supabaseAdmin.storage.from('photos').remove(photoPaths);
    }

    await supabaseAdmin.from('photos').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      throw authError;
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('delete-user error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erreur de suppression' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
