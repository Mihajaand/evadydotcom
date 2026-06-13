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

      const remoteValue = data?.value === 'true';
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
    try {
      await supabase.from('app_settings').upsert(
        [{ key: APP_SETTING_KEY, value: enabled ? 'true' : 'false' }],
        { onConflict: ['key'] }
      );
    } catch (error) {
      console.error('maintenanceStore supabase persist error', error);
    }

    try {
      await AsyncStorage.setItem(MAINTENANCE_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('maintenanceStore persist error', error);
    } finally {
      set({ isMaintenanceMode: enabled });
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
            const value = payload.new?.value === 'true';
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
