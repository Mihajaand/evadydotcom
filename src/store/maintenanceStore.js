/**
 * Store global de maintenance
 * Gère l'activation / désactivation du mode maintenance
 * via Supabase et AsyncStorage.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';

const MAINTENANCE_KEY = 'evady_maintenance_mode';
const APP_SETTING_KEY = 'maintenance_mode';

const useMaintenanceStore = create((set, get) => ({
  isMaintenanceMode: false,
  initialized: false,
  maintenanceChannel: null,

  refresh: async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', APP_SETTING_KEY)
        .maybeSingle();

      if (error) {
        console.error('maintenanceStore supabase refresh error', error);
      }

      // Accept both text 'true' and boolean true from Supabase
      const remoteValue = data?.value === 'true' || data?.value === true;
      const cachedValue = (await AsyncStorage.getItem(MAINTENANCE_KEY)) === 'true';
      const finalValue = data ? remoteValue : cachedValue;

      set({ isMaintenanceMode: finalValue });
      await AsyncStorage.setItem(MAINTENANCE_KEY, String(finalValue));
    } catch (error) {
      console.error('maintenanceStore refresh error', error);
    }
  },

  initialize: async () => {
    try {
      await get().refresh();
      set({ initialized: true });
      await get().subscribeToMaintenanceChanges();
    } catch (error) {
      console.error('maintenanceStore init error', error);
      set({ initialized: true });
    }
  },

  setMaintenanceMode: async (enabled) => {
    // Mettre à jour le cache local immédiatement (optimistic update)
    set({ isMaintenanceMode: enabled });

    // Persister en AsyncStorage
    try {
      await AsyncStorage.setItem(MAINTENANCE_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('maintenanceStore cache persist error', error);
    }

    // Appeler la Edge Function qui utilise le service_role pour updater Supabase
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase URL ou ANON_KEY non configurée');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/set-maintenance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ enabled }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Erreur inconnue');
      }

      console.log('maintenanceStore: maintenance_mode mis à jour avec succès via Edge Function');
    } catch (error) {
      console.error('maintenanceStore Edge Function error:', error.message);
      // Le cache local est déjà mis à jour et les autres clients verront le changement
      // via Realtime quand la DB sera mise à jour
    }
  },

  subscribeToMaintenanceChanges: async () => {
    try {
      const existingChannel = get().maintenanceChannel;
      if (existingChannel) {
        return existingChannel;
      }

      const channel = supabase
        .channel('maintenance-mode')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${APP_SETTING_KEY}` },
          (payload) => {
            // payload.new.value can be a string 'true'/'false' or a boolean true/false
            const value = payload.new?.value === 'true' || payload.new?.value === true;
            set({ isMaintenanceMode: value });
            AsyncStorage.setItem(MAINTENANCE_KEY, String(value)).catch((err) => {
              console.error('maintenanceStore cache update error', err);
            });
          }
        )
        .subscribe();

      set({ maintenanceChannel: channel });
      return channel;
    } catch (error) {
      console.error('maintenanceStore realtime subscribe error', error);
      return null;
    }
  },
}));

export default useMaintenanceStore;
