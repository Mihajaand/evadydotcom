import { useEffect } from 'react';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import { registerForPushNotifications, setupNotificationListeners } from '../utils/notifications';
import Constants from 'expo-constants';

// Détecter si on tourne dans l'application Expo Go
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

// Charger expo-notifications uniquement hors d'Expo Go pour éviter le crash natif SDK 53+
let Notifications = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('[RealtimeNotif] Impossible de charger expo-notifications:', error.message);
  }
}

const useRealtimeNotifications = () => {
  const user = useAuthStore((state) => state.user);
  const addLocalNotification = useNotificationStore((state) => state.addLocalNotification);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  useEffect(() => {
    if (!user?.id) return;

    // Charger les notifications initiales au montage
    fetchNotifications(user.id);

    // 1. Enregistrer le token de push et demander les permissions système
    registerForPushNotifications(user.id);

    // 2. Configurer les listeners pour le clic sur les notifications
    const unsubscribeNotifications = setupNotificationListeners((data) => {
      console.log('[RealtimeNotif] Notification cliquée:', data);
    });

    // 3. S'abonner aux changements de la table 'notifications' pour l'utilisateur en temps réel
    const channel = supabase
      .channel(`realtime-notifications-db-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Écoute tous les événements (INSERT, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new;
            try {
              // Récupérer le profil de la personne qui notifie
              const { data: notifierProfile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, gender')
                .eq('id', newNotif.notifier_id)
                .single();

              const enrichedNotif = {
                ...newNotif,
                notifier: notifierProfile,
              };

              // Mettre à jour l'état local du store instantanément
              addLocalNotification(enrichedNotif);

              // Déterminer le titre selon le type
              let title = '❤️ Nouveau Like !';
              let bodyText = newNotif.content;
              if (newNotif.type === 'message') {
                title = `💬 Nouveau message`;
                bodyText = `${notifierProfile?.full_name || 'Quelqu\'un'} vous a envoyé un message.`;
              } else if (newNotif.type === 'report') {
                title = '⚠️ Votre profil a été signalé';
              }

              // Déclencher la notification native en haut du téléphone (uniquement hors Expo Go)
              if (!isExpoGo && Notifications) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: title,
                    body: bodyText,
                    data: enrichedNotif,
                  },
                  trigger: null,
                });
              } else {
                console.log('[RealtimeNotif] Notification reçue via Supabase (affichage natif désactivé sous Expo Go):', title, bodyText);
              }
            } catch (err) {
              console.error('Erreur traitement realtime notification:', err);
            }
          } else if (payload.eventType === 'DELETE') {
            // Lors d'une suppression de doublon ou manuelle, on rafraîchit la liste et le compteur
            fetchNotifications(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      unsubscribeNotifications();
    };
  }, [user?.id]);
};

export default useRealtimeNotifications;