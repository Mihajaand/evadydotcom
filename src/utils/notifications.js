/**
 * Service de Notifications Push - E-VADY
 *
 * Gère :
 * - La demande de permission
 * - L'obtention du token Expo Push
 * - La sauvegarde du token dans Supabase (profiles.push_token)
 * - Les listeners de réception (foreground)
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabase/client';

// Configuration du comportement des notifications reçues en avant-plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Afficher la bannière même si l'app est ouverte
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Crée le canal de notification Android (obligatoire pour Android 8+)
 */
const createAndroidChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('evady-default', {
      name: 'E-VADY Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F13E93',
      sound: true,
    });
  }
};

/**
 * Demande la permission et retourne le token Expo Push.
 * Sauvegarde le token dans la colonne push_token du profil.
 *
 * @param {string} userId - L'ID de l'utilisateur connecté
 * @returns {string|null} Le token Expo Push ou null si refusé
 */
export const registerForPushNotifications = async (userId) => {
  try {
    // Créer le canal Android
    await createAndroidChannel();

    // Les simulateurs ne supportent pas les push notifications
    if (!Device.isDevice) {
      console.log('[Notif] Simulateur détecté, push notifications désactivées.');
      return null;
    }

    // Vérifier / demander la permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notif] Permission refusée par l\'utilisateur.');
      return null;
    }

    // Obtenir le token Expo Push
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('[Notif] Aucun projectId EAS trouvé. L\'enregistrement du token de push est ignoré (normal en Expo Go sans projet EAS).');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token) return null;

    // Sauvegarder le token dans Supabase
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[Notif] Erreur sauvegarde token:', error.message);
    } else {
      console.log('[Notif] Token enregistré avec succès:', token);
    }

    return token;
  } catch (error) {
    // Ne pas crasher l'app si les notifs échouent
    console.warn('[Notif] Erreur lors de l\'enregistrement des push notifications:', error.message);
    return null;
  }
};

/**
 * Configure les listeners de notifications :
 * - onReceived : notification reçue pendant que l'app est ouverte
 * - onResponse : utilisateur a tapé sur la notification
 *
 * @param {function} onNotificationTapped - Callback quand l'utilisateur tape la notif
 * @returns {function} Fonction de nettoyage à appeler au démontage
 */
export const setupNotificationListeners = (onNotificationTapped) => {
  // Notification reçue en foreground (app ouverte)
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[Notif] Notification reçue en foreground:', notification);
    }
  );

  // Utilisateur a appuyé sur la notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      console.log('[Notif] Notification tappée:', data);
      if (onNotificationTapped) {
        onNotificationTapped(data);
      }
    }
  );

  // Retourner la fonction de nettoyage
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};
