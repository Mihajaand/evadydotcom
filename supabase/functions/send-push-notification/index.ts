/**
 * Edge Function : send-push-notification
 * 
 * Envoyeur universel de notifications push via l'API Expo Push Service.
 * Appelée par les autres Edge Functions (on-new-message, on-new-like, on-new-report).
 * 
 * Body attendu : { token: string, title: string, body: string, data?: object }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { token, title, body, data } = await req.json();

    if (!token || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'token, title et body sont requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que c'est un token Expo valide
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return new Response(
        JSON.stringify({ error: 'Token invalide, doit être un ExponentPushToken' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Envoyer la notification via l'API Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId: 'evady-default',
      }),
    });

    const result = await response.json();
    console.log('[send-push-notification] Expo API response:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[send-push-notification] Erreur:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
