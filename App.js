/**
 * E-VADY - Application de rencontres
 * Point d'entrée principal
 * 
 * Stack: React Native (Expo) + Supabase + Stripe Checkout (web) + Zustand
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // 👈 1. Import ajouté
import Toast from 'react-native-toast-message';

import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/components/LoadingScreen';
import useAuth from './src/hooks/useAuth';
import useMaintenanceStore from './src/store/maintenanceStore';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['expo-notifications:']);

export default function App() {
  const { user, loading } = useAuth();
  const initializeMaintenance = useMaintenanceStore((state) => state.initialize);
  const refreshMaintenance = useMaintenanceStore((state) => state.refresh);
  const maintenanceInitialized = useMaintenanceStore((state) => state.initialized);

  React.useEffect(() => {
    if (!loading) {
      if (!maintenanceInitialized) {
        initializeMaintenance();
      } else if (user) {
        refreshMaintenance();
      }
    }
  }, [loading, user, maintenanceInitialized, initializeMaintenance, refreshMaintenance]);

  if (loading) {
    return <LoadingScreen message="Chargement de E-VADY..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 👈 2. Envelopper NavigationContainer avec SafeAreaProvider */}
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}