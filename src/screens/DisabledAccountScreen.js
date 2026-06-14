import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import useAuthStore from '../store/authStore';

const DisabledAccountScreen = () => {
  const logout = useAuthStore((state) => state.logout);

  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await logout();
    } catch (error) {
      setLoading(false);
      console.warn('Erreur logout:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={64} color={COLORS.primary} />
        <Text style={styles.title}>Compte désactivé</Text>
        <Text style={styles.subtitle}>
          Votre compte a été temporairement désactivé par un administrateur.
          {'\n'}Veuillez contacter le support ou réessayer plus tard.
        </Text>
        <TouchableOpacity style={[styles.logoutButton, loading && styles.logoutButtonDisabled]} onPress={handleLogout} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.logoutText}>Se déconnecter</Text>
          )}
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
  logoutButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  logoutButtonDisabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.6,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

export default DisabledAccountScreen;
