/**
 * Edge Function : on-new-report
 *
 * Déclenchée par un Database Webhook Supabase sur INSERT dans la table `reports`.
 * Envoie une notification push au profil signalé avec le décompte de signalements.
 *
 * Seuil de bannissement : 5 signalements
 * Notification envoyée à partir du 1er signalement.
 *
 * Payload Supabase Webhook :
 * { type: "INSERT", table: "reports", record: { id, reporter_id, reported_id, reason, created_at } }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SEND_PUSH_URL = `${supabaseUrl}/functions/v1/send-push-notification`;

// Nombre de signalements avant bannissement
const BAN_THRESHOLD = 5;

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    console.log('[on-new-report] Payload reçu:', JSON.stringify(payload));

    // Vérifier que c'est bien un INSERT de signalement
    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response('Événement ignoré', { status: 200 });
    }

    const report = payload.record;
    const { reported_id } = report;

    if (!reported_id) {
      return new Response('Champ reported_id manquant', { status: 400 });
    }

    // Client Supabase avec droits admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Compter le total des signalements pour ce profil
    const { count, error: countError } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_id', reported_id);

    if (countError) {
      throw new Error(`Erreur comptage signalements: ${countError.message}`);
    }

    const totalReports = count ?? 0;
    const remaining = BAN_THRESHOLD - totalReports;

    console.log(`[on-new-report] Profil ${reported_id} : ${totalReports} signalement(s), ${remaining} restant(s) avant ban`);

    // Récupérer le push_token du profil signalé
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('push_token, full_name')
      .eq('id', reported_id)
      .single();

    if (profileError || !profileData?.push_token) {
      console.log('[on-new-report] Pas de token pour le profil signalé:', reported_id);
      return new Response('Pas de token destinataire', { status: 200 });
    }

    // Composer le message selon le nombre de signalements restants
    let notifTitle: string;
    let notifBody: string;

    if (remaining <= 0) {
      // Compte atteint ou dépassé → bannissement imminent
      notifTitle = '🚨 Votre compte va être banni';
      notifBody = `Votre profil a atteint ${totalReports} signalements. Votre compte peut être banni à tout moment.`;
    } else {
      notifTitle = '⚠️ Votre profil a été signalé';
      notifBody = `Votre profil a été signalé ${totalReports} fois. Il vous reste ${remaining} signalement${remaining > 1 ? 's' : ''} avant le bannissement de votre compte.`;
    }

    // Insérer également dans la table notifications persistante
    try {
      await supabase.from('notifications').insert({
        user_id: reported_id,
        notifier_id: reported_id, // Utiliser le signalé pour anonymiser le dénonciateur
        type: 'report',
        content: notifBody,
      });
    } catch (notifErr) {
      console.error('[on-new-report] Erreur insertion notifications table:', notifErr.message);
    }

    // Envoyer la notification
    const sendRes = await fetch(SEND_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        token: profileData.push_token,
        title: notifTitle,
        body: notifBody,
        data: {
          type: 'report',
          reportedId: reported_id,
          totalReports,
          remaining: Math.max(0, remaining),
        },
      }),
    });

    const result = await sendRes.json();
    console.log('[on-new-report] Notification envoyée:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, totalReports, remaining }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[on-new-report] Erreur:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
