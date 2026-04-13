/**
 * Écran d'inscription
 * Email + mot de passe + genre (M/F) + date de naissance + localisation
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GENDERS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useLocation from '../hooks/useLocation';
import Input from '../components/Input';
import Button from '../components/Button';

const SignupScreen = ({ navigation }) => {
  // État du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState(null);
  const [birthdate, setBirthdate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const signup = useAuthStore((state) => state.signup);
  const { location } = useLocation();

  /**
   * Validation et inscription
   */
  const handleSignup = async () => {
    // Validations
    if (!fullName.trim()) {
      Alert.alert('Erreur', 'Entrez votre nom complet');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Erreur', 'Entrez votre email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (!gender) {
      Alert.alert('Erreur', 'Sélectionnez votre genre');
      return;
    }
    if (!birthdate) {
      Alert.alert('Erreur', 'Sélectionnez votre date de naissance');
      return;
    }

    // Vérification de l'âge (18+)
    const age = new Date().getFullYear() - birthdate.getFullYear();
    if (age < 18) {
      Alert.alert('Erreur', 'Vous devez avoir au moins 18 ans');
      return;
    }

    setLoading(true);
    try {
      await signup({
        email,
        password,
        fullName: fullName.trim(),
        gender,
        birthdate: birthdate.toISOString().split('T')[0],
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
      });
    } catch (error) {
      Alert.alert('Erreur d\'inscription', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formatage de la date pour affichage
   */
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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
        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez E-VADY dès maintenant</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Input
            label="Nom complet"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jean Dupont"
            icon="person-outline"
            autoCapitalize="words"
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="jean@email.com"
            keyboardType="email-address"
            icon="mail-outline"
          />

          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 6 caractères"
            secureTextEntry
            icon="lock-closed-outline"
          />

          <Input
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Retapez votre mot de passe"
            secureTextEntry
            icon="lock-closed-outline"
          />

          {/* Sélecteur de genre */}
          <Text style={styles.label}>Genre</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[
                  styles.genderBtn,
                  gender === g.value && styles.genderBtnActive,
                ]}
                onPress={() => setGender(g.value)}
              >
                <Ionicons
                  name={g.value === 'MALE' ? 'male' : 'female'}
                  size={22}
                  color={gender === g.value ? COLORS.white : COLORS.primary}
                />
                <Text
                  style={[
                    styles.genderText,
                    gender === g.value && styles.genderTextActive,
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sélecteur de date de naissance */}
          <Text style={styles.label}>Date de naissance</Text>
          <TouchableOpacity
            style={styles.datePicker}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={COLORS.gray} />
            <Text style={[styles.dateText, !birthdate && styles.placeholder]}>
              {birthdate ? formatDate(birthdate) : 'Sélectionner une date'}
            </Text>
          </TouchableOpacity>

          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="date"
            onConfirm={(date) => {
              setBirthdate(date);
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
            maximumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
            locale="fr"
          />

          {/* Info localisation */}
          <View style={styles.locationInfo}>
            <Ionicons
              name={location ? 'location' : 'location-outline'}
              size={18}
              color={location ? COLORS.secondary : COLORS.gray}
            />
            <Text style={[styles.locationText, location && styles.locationActive]}>
              {location ? 'Localisation activée' : 'Localisation en attente...'}
            </Text>
          </View>

          {/* Bouton inscription */}
          <Button
            title="S'inscrire"
            onPress={handleSignup}
            loading={loading}
            style={styles.signupBtn}
          />

          {/* Retour connexion */}
          <View style={styles.loginRow}>
            <Text style={styles.loginLabel}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  backBtn: {
    marginBottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.black,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 4,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 8,
  },
  genderBtnActive: {
    backgroundColor: COLORS.primary,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  genderTextActive: {
    color: COLORS.white,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.black,
  },
  placeholder: {
    color: COLORS.gray,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    padding: 12,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
  },
  locationText: {
    color: COLORS.gray,
    fontSize: 14,
  },
  locationActive: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  signupBtn: {
    marginBottom: 24,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLabel: {
    color: COLORS.darkGray,
    fontSize: 14,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default SignupScreen;
