/**
 * E-VADY - Application de rencontres
 * Point d'entrée principal
 * 
 * Stack: React Native (Expo) + Supabase + Stripe Checkout (web) + Zustand
 */
/**
 * E-VADY - Application de rencontres
 * Point d'entrée principal
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/components/LoadingScreen';
import useAuth from './src/hooks/useAuth';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Chargement de E-VADY..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
