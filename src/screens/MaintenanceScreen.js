import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useMaintenanceStore from '../store/maintenanceStore';

/**
 * 
 * @returns 
 *
 */
const MaintenanceScreen = () => {
  const logout = useAuthStore((state) => state.logout);
  const isMaintenanceMode = useMaintenanceStore((state) => state.isMaintenanceMode);


/**
 * Écran de maintenance
 * Affiché lorsque le mode maintenance est activé.
 */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.warn('Erreur logout:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="warning-outline" size={64} color={COLORS.primary} />
        <Text style={styles.title}>Mode maintenance</Text>
        <Text style={styles.subtitle}>
          L'application est temporairement en maintenance.
          {'\n'}Veuillez réessayer dans quelques minutes.
        </Text>
        {/* <Text style={styles.status}>
          Statut actuel : {isMaintenanceMode ? 'Activé' : 'Désactivé'}
        </Text> */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  title: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    fontSize: 15,
    color: COLORS.darkGray,
    lineHeight: 22,
    textAlign: 'center',
  },
  status: {
    marginTop: 18,
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

export default MaintenanceScreen;
