/**
 * Edge Function : on-new-message
 *
 * Déclenchée par un Database Webhook Supabase sur INSERT dans la table `messages`.
 * Envoie une notification push au destinataire du message.
 *
 * Payload Supabase Webhook :
 * { type: "INSERT", table: "messages", record: { id, sender_id, receiver_id, content, ... } }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SELF_URL = `${supabaseUrl}/functions/v1/send-push-notification`;

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    console.log('[on-new-message] Payload reçu:', JSON.stringify(payload));

    // Vérifier que c'est bien un INSERT de message
    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response('Événement ignoré', { status: 200 });
    }

    const message = payload.record;
    const { sender_id, receiver_id, content } = message;

    if (!sender_id || !receiver_id) {
      return new Response('Champs manquants', { status: 400 });
    }

    // Client Supabase avec droits admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer le push_token du destinataire ET le nom de l'expéditeur en parallèle
    const [receiverResult, senderResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('push_token, full_name')
        .eq('id', receiver_id)
        .single(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', sender_id)
        .single(),
    ]);

    const receiverToken = receiverResult.data?.push_token;
    const senderName = senderResult.data?.full_name || 'Quelqu\'un';

    if (!receiverToken) {
      console.log('[on-new-message] Pas de token pour le destinataire:', receiver_id);
      return new Response('Pas de token destinataire', { status: 200 });
    }

    // Préparer le corps de la notification (tronquer si trop long)
    const isImage = content?.startsWith('[IMAGE]:');
    const notifBody = isImage ? '📷 Vous a envoyé une photo' : content?.substring(0, 100) || '';

    // Appeler la fonction d'envoi universelle
    const sendRes = await fetch(SELF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        token: receiverToken,
        title: `💬 Nouveau message de ${senderName}`,
        body: notifBody,
        data: {
          type: 'message',
          senderId: sender_id,
          senderName,
        },
      }),
    });

    const result = await sendRes.json();
    console.log('[on-new-message] Notification envoyée:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[on-new-message] Erreur:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
