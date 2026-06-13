/**
 * Store global de maintenance
 * Gère l'activation / désactivation du mode maintenance
 * et la persistance locale avec AsyncStorage.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAINTENANCE_KEY = 'evady_maintenance_mode';

const useMaintenanceStore = create((set) => ({
  isMaintenanceMode: false,
  initialized: false,

  initialize: async () => {
    try {
      const value = await AsyncStorage.getItem(MAINTENANCE_KEY);
      set({ isMaintenanceMode: value === 'true', initialized: true });
    } catch (error) {
      console.error('maintenanceStore init error', error);
      set({ initialized: true });
    }
  },

  setMaintenanceMode: async (enabled) => {
    try {
      await AsyncStorage.setItem(MAINTENANCE_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('maintenanceStore persist error', error);
    } finally {
      set({ isMaintenanceMode: enabled });
    }
  },
}));

export default useMaintenanceStore;
