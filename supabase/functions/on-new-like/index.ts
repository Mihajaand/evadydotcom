/**
 * Edge Function : on-new-like
 *
 * Déclenchée par un Database Webhook Supabase sur INSERT dans la table `likes`.
 * Envoie une notification push à la personne qui a reçu le like.
 *
 * Payload Supabase Webhook :
 * { type: "INSERT", table: "likes", record: { id, liker_id, liked_id, created_at } }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SEND_PUSH_URL = `${supabaseUrl}/functions/v1/send-push-notification`;

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    console.log('[on-new-like] Payload reçu:', JSON.stringify(payload));

    // Vérifier que c'est bien un INSERT de like
    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response('Événement ignoré', { status: 200 });
    }

    const like = payload.record;
    const { liker_id, liked_id } = like;

    if (!liker_id || !liked_id) {
      return new Response('Champs liker_id / liked_id manquants', { status: 400 });
    }

    // Client Supabase avec droits admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer le push_token du profil liké ET le nom de celui qui like
    const [likedResult, likerResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('push_token, full_name')
        .eq('id', liked_id)
        .single(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', liker_id)
        .single(),
    ]);

    const likedToken = likedResult.data?.push_token;
    const likerName = likerResult.data?.full_name || 'Quelqu\'un';

    if (!likedToken) {
      console.log('[on-new-like] Pas de token pour le profil liké:', liked_id);
      return new Response('Pas de token pour le destinataire', { status: 200 });
    }

    // Envoyer la notification
    const sendRes = await fetch(SEND_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        token: likedToken,
        title: '❤️ Vous avez reçu un Like !',
        body: `${likerName} a aimé votre profil`,
        data: {
          type: 'like',
          likerId: liker_id,
          likerName,
        },
      }),
    });

    const result = await sendRes.json();
    console.log('[on-new-like] Notification envoyée:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[on-new-like] Erreur:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
