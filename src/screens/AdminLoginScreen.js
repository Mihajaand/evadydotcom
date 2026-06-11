/**
 * Écran de Connexion Admin — Style Premium Dark
 * Vérification des identifiants hardcodés via adminStore
 * Aucun appel Supabase Auth
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { customAlert } from '../utils/helpers';
import useAdminStore from '../store/adminStore';

const Alert = { alert: customAlert };

const AdminLoginScreen = ({ navigation }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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

    // Petit délai simulé pour UX (empêche brute force rapide)
    setTimeout(() => {
      const success = adminLogin(login.trim(), password);
      setLoading(false);

      if (success) {
        navigation.replace('AdminDashboard');
      } else {
        Alert.alert('Accès refusé', 'Identifiants incorrects');
        setPassword('');
      }
    }, 800);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bouton retour */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#888" />
        </TouchableOpacity>

        {/* Icône bouclier */}
        <View style={styles.iconContainer}>
          <View style={styles.shieldBg}>
            <Ionicons name="shield-checkmark" size={56} color="#FF3B3B" />
          </View>
        </View>

        <Text style={styles.title}>Administration</Text>
        <Text style={styles.subtitle}>Accès restreint — Personnel autorisé uniquement</Text>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Champ Login */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Identifiant</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={login}
                onChangeText={setLogin}
                placeholder="Identifiant admin"
                placeholderTextColor="#555"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Champ Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                placeholderTextColor="#555"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton connexion */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleAdminLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFF" />
                <Text style={styles.loginBtnText}>Accéder au Dashboard</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Avertissement */}
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color="#FF6B35" />
          <Text style={styles.warningText}>
            Toute tentative d'accès non autorisé est enregistrée.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 59, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 59, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 36,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#AAA',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeBtn: {
    padding: 8,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B3B',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 12,
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  warningText: {
    flex: 1,
    color: '#FF6B35',
    fontSize: 12,
    lineHeight: 17,
  },
});

export default AdminLoginScreen;
