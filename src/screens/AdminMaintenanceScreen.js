import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import useMaintenanceStore from '../store/maintenanceStore';
import useAdminStore from '../store/adminStore';

const AdminMaintenanceScreen = ({ navigation }) => {
  const isMaintenanceMode = useMaintenanceStore((state) => state.isMaintenanceMode);
  const setMaintenanceMode = useMaintenanceStore((state) => state.setMaintenanceMode);
  const adminLogout = useAdminStore((state) => state.adminLogout);

  const toggleMaintenance = async (value) => {
    await setMaintenanceMode(value);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleLogout = () => {
    adminLogout();
    navigation.replace('AdminLogin');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mode maintenance</Text>
        </View>

        <Ionicons name="server-outline" size={72} color={COLORS.primary} />
        <Text style={styles.title}>Fonction maintenance</Text>
        <Text style={styles.subtitle}>
          Activez ou désactivez le mode maintenance pour tous les utilisateurs.
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Maintenance activée</Text>
          <Switch
            value={isMaintenanceMode}
            onValueChange={toggleMaintenance}
            thumbColor={isMaintenanceMode ? COLORS.white : COLORS.white}
            trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
          />
        </View>

        <Text style={styles.helperText}>
          {isMaintenanceMode
            ? 'Les utilisateurs connectés verront désormais la page de maintenance.'
            : 'L’application revient à l’état normal pour les utilisateurs.'}
        </Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion admin</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 7,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.black,
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.darkGray,
    lineHeight: 20,
    textAlign: 'center',
  },
  switchRow: {
    width: '100%',
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 18,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: 24,
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

export default AdminMaintenanceScreen;
