/**
 * Navigation principale de l'application E-VADY
 * 
 * Structure:
 * - AuthStack: Login, Signup (non connecté)
 * - MainStack: Tabs + ChatScreen + SubscriptionScreen (connecté)
 *   - Tabs: Accueil, Recherche, Messages, Profil
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';

// Écrans Auth
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

// Écrans principaux
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Stack d'authentification (Login + Signup)
 */
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.white },
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
  </Stack.Navigator>
);

/**
 * Barre d'onglets principale avec icônes et badge
 */
const MainTabs = () => {
  const unreadTotal = useMessageStore((state) => state.unreadTotal);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Accueil':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'Recherche':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profil':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <View>
              <Ionicons name={iconName} size={size} color={color} />
              {/* Badge non-lu sur l'onglet Messages (masqué si l'onglet est actif) */}
              {route.name === 'Messages' && !focused && unreadTotal > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.lightGray,
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Recherche" component={SearchScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

/**
 * Navigation principale (avec les écrans empilés au-dessus des tabs)
 */
const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.white },
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={{
        animation: 'slide_from_right',
      }}
    />
    <Stack.Screen
      name="Subscription"
      component={SubscriptionScreen}
      options={{
        presentation: 'modal',
      }}
    />
  </Stack.Navigator>
);

/**
 * Navigateur racine - Affiche AuthStack ou MainStack selon l'état d'authentification
 */
const AppNavigator = () => {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  // Utilisateur connecté ET profil chargé → Afficher l'app
  if (user && profile) {
    return <MainStack />;
  }

  // Non connecté → Afficher l'auth
  return <AuthStack />;
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
});

export default AppNavigator;
