/**
 * E-VADY - Application de rencontres
 * Point d'entrée principal
 * 
 * Stack: React Native (Expo) + Supabase + Stripe Checkout (web) + Zustand
 */
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/components/LoadingScreen';
import OpeningScreen from './src/components/OpeningScreen';
import useAuth from './src/hooks/useAuth';
import useMaintenanceStore from './src/store/maintenanceStore';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['expo-notifications:']);

export default function App() {
  const [isShowOpening, setIsShowOpening] = useState(true);
  const { user, loading } = useAuth();
  const initializeMaintenance = useMaintenanceStore((state) => state.initialize);
  const refreshMaintenance = useMaintenanceStore((state) => state.refresh);
  const maintenanceInitialized = useMaintenanceStore((state) => state.initialized);

  useEffect(() => {
    if (!loading) {
      if (!maintenanceInitialized) {
        initializeMaintenance();
      } else if (user) {
        refreshMaintenance();
      }
    }
  }, [loading, user, maintenanceInitialized, initializeMaintenance, refreshMaintenance]);

  // Affiche la vidéo de démarrage en priorité au lancement
  if (isShowOpening) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar hidden />
          <OpeningScreen onFinish={() => setIsShowOpening(false)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Écran de chargement principal après la vidéo
  if (loading) {
    return <LoadingScreen message="Chargement de E-VADY..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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