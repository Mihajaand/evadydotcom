import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';
import { registerForPushNotifications, setupNotificationListeners } from '../utils/notifications';

const useRealtimeNotifications = () => {
  const user = useAuthStore((state) => state.user);
  const activePartnerId = useMessageStore((state) => state.activePartnerId);

  useEffect(() => {
    if (!user?.id) return;

    // 1. Enregistrer le token de push et demander les permissions système
    registerForPushNotifications(user.id);

    // 2. Configurer les listeners pour le clic sur les notifications
    const unsubscribeNotifications = setupNotificationListeners((data) => {
      console.log('[RealtimeNotif] Notification cliquée avec données:', data);
      // Ici, on pourrait ajouter une navigation personnalisée si nécessaire.
    });

    // Seuil de bannissement
    const BAN_THRESHOLD = 5;

    // 3. S'abonner aux canaux de temps réel de Supabase
    const channel = supabase
      .channel(`realtime-notifications-${user.id}`)
      // Écoute des Likes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
        },
        async (payload) => {
          const newLike = payload.new;
          if (newLike.liked_id === user.id) {
            try {
              // Récupérer le nom de la personne qui a liké
              const { data: likerProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newLike.liker_id)
                .single();

              const likerName = likerProfile?.full_name || 'Quelqu\'un';

              // Déclencher une notification native au haut du téléphone
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '❤️ Vous avez reçu un Like !',
                  body: `${likerName} a aimé votre profil`,
                  data: { type: 'like', likerId: newLike.liker_id },
                },
                trigger: null,
              });
            } catch (err) {
              console.error('Erreur lors du traitement de la notification de Like:', err);
            }
          }
        }
      )
      // Écoute des Messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new;
          // Si le message m'est destiné ET que je ne suis pas actuellement en train de discuter avec l'expéditeur
          if (newMessage.receiver_id === user.id && activePartnerId !== newMessage.sender_id) {
            try {
              // Récupérer le nom de l'expéditeur
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newMessage.sender_id)
                .single();

              const senderName = senderProfile?.full_name || 'Quelqu\'un';
              const isImage = newMessage.content?.startsWith('[IMAGE]:');
              const messageSnippet = isImage ? '📷 Photo' : newMessage.content;

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `💬 Nouveau message de ${senderName}`,
                  body: messageSnippet,
                  data: { type: 'message', senderId: newMessage.sender_id },
                },
                trigger: null,
              });
            } catch (err) {
              console.error('Erreur lors du traitement de la notification de Message:', err);
            }
          }
        }
      )
      // Écoute des Signalements
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reports',
        },
        async (payload) => {
          const newReport = payload.new;
          if (newReport.reported_id === user.id) {
            try {
              // Compter le nombre de signalements total
              const { count } = await supabase
                .from('reports')
                .select('id', { count: 'exact', head: true })
                .eq('reported_id', user.id);

              const totalReports = count || 1;
              const remaining = BAN_THRESHOLD - totalReports;

              let notifTitle = '⚠️ Votre profil a été signalé';
              let notifBody = `Votre profil a été signalé ${totalReports} fois. Il vous reste ${remaining} signalement(s) avant le bannissement de votre compte.`;

              if (remaining <= 0) {
                notifTitle = '🚨 Compte sur le point d\'être banni';
                notifBody = `Votre profil a atteint le maximum de signalements (${totalReports}). Votre compte va être suspendu.`;
              }

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: notifTitle,
                  body: notifBody,
                  data: { type: 'report', totalReports, remaining: Math.max(0, remaining) },
                },
                trigger: null,
              });
            } catch (err) {
              console.error('Erreur lors du traitement de la notification de Signalement:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      unsubscribeNotifications();
    };
  }, [user?.id, activePartnerId]);
};

export default useRealtimeNotifications;
