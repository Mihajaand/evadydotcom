/**
 * AdminLoginScreen — Connexion Admin
 * Thème identique à l'application principale (blanc, rose #F13E93)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { customAlert } from '../utils/helpers';
import useAdminStore from '../store/adminStore';

const Alert = { alert: customAlert };

const AdminLoginScreen = ({ navigation }) => {
  const [login,        setLogin]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const adminLogin = useAdminStore((state) => state.adminLogin);

  const handleAdminLogin = () => {
    if (!login.trim()) {
      Alert.alert('Erreur', 'Entrez votre identifiant admin');
      return;
    }
    if (!password) {
      Alert.alert('Erreur', 'Entrez le mot de passe admin');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const success = adminLogin(login.trim(), password);
      setLoading(false);
      if (success) {
        navigation.replace('AdminDashboard');
      } else {
        Alert.alert('Accès refusé', 'Identifiant ou mot de passe incorrect');
        setPassword('');
      }
    }, 700);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton retour */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.black} />
        </TouchableOpacity>

        {/* Logo + icône bouclier */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.shieldRow}>
            <View style={styles.shieldIcon}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
            </View>
            <Text style={styles.adminLabel}>ESPACE ADMIN</Text>
          </View>
          <Text style={styles.title}>E-VADY</Text>
          <Text style={styles.subtitle}>Panneau d'administration sécurisé</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Identifiant */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Identifiant Admin</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={login}
                onChangeText={setLogin}
                placeholder="Identifiant"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleAdminLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.white} />
                <Text style={styles.loginBtnText}>Accéder au Dashboard</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Avertissement */}
        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={15} color={COLORS.gray} />
          <Text style={styles.warningText}>
            Accès réservé aux administrateurs autorisés.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 28,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 90, height: 90, marginBottom: 12,
  },
  shieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 8,
  },
  shieldIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  adminLabel: {
    fontSize: 11, fontWeight: '900', color: COLORS.primary,
    letterSpacing: 2, textTransform: 'uppercase',
  },
  title: {
    fontSize: 32, fontWeight: '900', color: COLORS.primary, letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14, color: COLORS.gray, marginTop: 4,
  },

  // Formulaire
  form:        { gap: 16 },
  inputGroup:  { gap: 8 },
  label: {
    fontSize: 13, fontWeight: '700', color: COLORS.black,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  inputIcon:   { marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 14,
    fontSize: 15, color: COLORS.black,
  },
  eyeBtn: { padding: 6 },

  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 15, borderRadius: 14, gap: 10,
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
    elevation: 5,
  },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  // Avertissement
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 36, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.lightGray, borderRadius: 10,
  },
  warningText: { flex: 1, color: COLORS.gray, fontSize: 12, lineHeight: 17 },
});

export default AdminLoginScreen;
