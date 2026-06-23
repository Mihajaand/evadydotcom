/**
 * Écran d'inscription Multi-Étapes Premium
 * 
 * Étape 1 : Identifiants & Infos de base
 * Étape 2 : Vérification du Code PIN par Email (EmailJS)
 * Étape 3 : Personnalisation du Profil (Photo obligatoire, Taille, Profession, Tags d'intérêts, croyances, style de vie)
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { customAlert } from '../utils/helpers';

const Alert = {
  alert: customAlert,
};
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { COLORS, GENDERS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useLocation from '../hooks/useLocation';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../supabase/client';

// Options pour les Tags
const INTEREST_OPTIONS = ['Sport ⚽', 'Musique 🎵', 'Voyage ✈️', 'Cuisine 🍳', 'Cinéma 🎬', 'Lecture 📚', 'Jeux Vidéo 🎮', 'Art 🎨', 'Photo 📷', 'Nature 🌲', 'Autre 👤'];
const BELIEF_OPTIONS = ['Chrétien ✝️', 'Musulman ☪️', 'Athée ⚛️', 'Spirituel 🧘', 'Autre 👤'];
const LIFESTYLE_OPTIONS = ['Fêtard 🥳', 'Calme ☕', 'Sportif 🏋️', 'Végétarien 🥗', 'Aventurier ⛰️', 'Écolo 🌱'];
const PROFESSION_OPTIONS = [
  'Développeur 💻',
  'Designer 🎨',
  'Business / Entrepreneur 💼',
  'Étudiant 📚',
  'Enseignant 🏫',
  'Médecin / Soignant 🩺',
  'Ingénieur ⚙️',
  'Artiste / Créateur 🎭',
  'Freelance 💻',
  'Autre 👤'
];

const SignupScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ÉTAPE 1 : Identité
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState(null);
  const [birthdate, setBirthdate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { location } = useLocation();

  // ÉTAPE 2 : Code de vérification par EmailJS
  const [generatedCode, setGeneratedCode] = useState('');
  const [userCode, setUserCode] = useState('');

  // ÉTAPE 3 : Personnalisation
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [height, setHeight] = useState(170);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedBeliefs, setSelectedBeliefs] = useState('');
  const [selectedLifestyles, setSelectedLifestyles] = useState([]);

  const signup = useAuthStore((state) => state.signup);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const user = useAuthStore((state) => state.user);

  /**
   * Formatage de la date
   */
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  /**
   * ÉTAPE 1 -> ÉTAPE 2 : Valider les infos de base et envoyer le code EmailJS
   */
  const handleValidateStep1 = async () => {
    if (!fullName.trim()) return Alert.alert('Erreur', 'Entrez votre nom complet');
    if (!email.trim()) return Alert.alert('Erreur', 'Entrez votre email');
    if (password.length < 6) return Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
    if (password !== confirmPassword) return Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
    if (!gender) return Alert.alert('Erreur', 'Sélectionnez votre genre');
    if (!birthdate) return Alert.alert('Erreur', 'Sélectionnez votre date de naissance');

    const age = new Date().getFullYear() - birthdate.getFullYear();
    if (age < 18) return Alert.alert('Erreur', 'Vous devez avoir au moins 18 ans');

    setLoading(true);

    // Générer le code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    try {
  const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log('[Dev] Clefs EmailJS manquantes. Code de vérification :', code);

    Alert.alert(
      'Mode Développement',
      `Clefs EmailJS non configurées. Code simulé : ${code}`
    );

    setStep(2);
    return;
  }

  // 🔥 ENVOI EMAILJS
  const response = await fetch(
    'https://api.emailjs.com/api/v1.0/email/send',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,

        // ✅ UNIQUEMENT user_id (qui correspond à la public_key d'EmailJS)
        user_id: publicKey,

        // Si le mode strict est activé sur EmailJS, la clé privée est requise
        ...(privateKey && { accessToken: privateKey }),

        template_params: {
          to_email: email.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          user_email: email.trim().toLowerCase(),
          to_name: fullName.trim(),
          verification_code: code,
        },
      }),
    }
  );

  const resultText = await response.text();

  if (!response.ok) {
    throw new Error(resultText || 'Erreur lors de l\'envoi de l\'email');
  }

  Alert.alert(
    'Succès',
    'Un code de vérification a été envoyé sur votre email.'
  );

  setStep(2);

} catch (error) {
  console.error('Erreur EmailJS:', error);

  Alert.alert(
    'Erreur d\'envoi',
    `Impossible d'envoyer le code. Code de secours : ${code}`
  );

  setStep(2);

} finally {
  setLoading(false);
}
  };

  /**
   * ÉTAPE 2 -> ÉTAPE 3 : Validation du code PIN saisi
   */
  const handleVerifyCode = () => {
    if (userCode.trim() === generatedCode) {
      setStep(3);
    } else {
      Alert.alert('Code invalide', 'Le code de vérification est incorrect.');
    }
  };

  /**
   * ÉTAPE 3 : Sélection de la photo
   */
  const handleSelectPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0]);
    }
  };

  // Gestion des Tags
  const toggleInterest = (interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleLifestyle = (lifestyle) => {
    setSelectedLifestyles((prev) =>
      prev.includes(lifestyle) ? prev.filter((l) => l !== lifestyle) : [...prev, lifestyle]
    );
  };

  /**
   * ÉTAPE 3 : Soumission finale et création du compte
   */
  const handleFinalSubmit = async () => {
    if (!profilePhoto) {
      return Alert.alert('Photo requise', 'Veuillez ajouter au moins une photo de profil pour vous inscrire.');
    }

    setLoading(true);
    let createdUserSession = null;

    try {
      // 1. Inscrire l'utilisateur sur Supabase Auth
      createdUserSession = await signup({
        email,
        password,
        fullName: fullName.trim(),
        gender,
        birthdate: birthdate.toISOString().split('T')[0],
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
      });

      // Assurer que le client Supabase a bien récupéré la session avant d'uploader
      try {
        await supabase.auth.getSession();
      } catch (sessErr) {
        console.warn('Impossible de récupérer la session immédiatement après signup:', sessErr?.message || sessErr);
      }

      const currentUserId = createdUserSession.user.id;

      // 2. Uploader l'avatar dans le stockage public
      let fileExt = 'jpg';
      let uploadBody;
      let contentType = 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(profilePhoto.uri);
        const blob = await response.blob();
        uploadBody = blob;
        contentType = blob.type || 'image/jpeg';
        fileExt = contentType.split('/').pop() || 'jpg';
      } else {
        fileExt = profilePhoto.uri.split('.').pop().toLowerCase();
        const base64 = profilePhoto.base64;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        uploadBody = bytes.buffer;
        contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      }

      const fileName = `${currentUserId}/profile_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, uploadBody, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        if (String(uploadError.message || '').toLowerCase().includes('row-level security')) {
          Alert.alert('Autorisation refusée', "Impossible d'uploader la photo: la politique RLS bloque l'opération. Vérifiez les policies Supabase ou la session utilisateur.");
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const avatarPublicUrl = urlData.publicUrl;

      // 3. Attendre que la session soit bien établie avant l'insert (auth.uid() doit être disponible)
      // Petite pause pour que la session soit propagée dans le context Supabase
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3bis. Enregistrer l'avatar dans la table des photos
      const { error: photoInsertError } = await supabase.from('photos').insert({
        user_id: currentUserId,
        url: avatarPublicUrl,
        is_profile: true,
      });

      if (photoInsertError) {
        console.error('Erreur insertion photo:', photoInsertError);
        Alert.alert('Avertissement', `Photo uploadée mais non enregistrée: ${photoInsertError.message}. Vous pouvez ajouter des photos plus tard dans votre profil.`);
      }

      // 4. Mettre à jour le profil avec toutes les nouvelles informations de personnalisation
      // ⚠️ Utiliser directement supabase au lieu de updateProfile() du store
      // car le store n'est pas encore à jour après le signup (user pas encore initié)
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarPublicUrl,
          profession: profession === 'Autre 👤' ? customProfession.trim() : profession,
          height: height ? `${height} cm` : null,
          interests: selectedInterests,
          beliefs: selectedBeliefs,
          lifestyle: selectedLifestyles,
        })
        .eq('id', currentUserId)
        .select()
        .single();

      if (updateError) {
        console.error('Erreur mise à jour profil:', updateError);
        Alert.alert('Erreur', `Profil partiellement créé: ${updateError.message}. Vous pouvez mettre à jour votre profil plus tard.`);
      }

      console.log('Profil créé lors de l\'inscription:', updatedProfile);

      // 5. IMPORTANT : Recharger le profil du store pour que l'app affiche les bonnes données
      // Sans ceci, le store aurait les données de base mais pas avatar_url, profession, etc.
      await fetchProfile(currentUserId);

      Alert.alert('Inscription réussie !', 'Bienvenue sur E-VADY !');
    } catch (error) {
      const message =
        error?.message ||
        error?.error ||
        (typeof error === 'string' ? error : 'Une erreur est survenue lors de la création de votre profil.');

      const normalized = String(message).toLowerCase();
      if (normalized.includes('un compte existe déjà') || normalized.includes('already exists') || normalized.includes('duplicate')) {
        Alert.alert('Email déjà utilisé', 'Un compte existe déjà avec cet email. Veuillez utiliser une autre adresse ou vous connecter.');
      } else {
        Alert.alert('Erreur', message);
      }
    } finally {
      setLoading(false);
    }
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
        {/* En-tête de retour */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Étape {step} sur 3</Text>
        </View>

        {/* --- ÉTAPE 1 : Identité & Identifiants --- */}
        {step === 1 && (
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
              autoCapitalize="none"
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
              placeholder="Retapez le mot de passe"
              secureTextEntry
              icon="lock-closed-outline"
            />

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
                    size={20}
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

             <Text style={styles.label}>Date de naissance</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.lightGray,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  border: 'none',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  color: birthdate ? COLORS.black : COLORS.gray,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                max={new Date(new Date().getFullYear() - 18, 11, 31).toISOString().split('T')[0]}
                value={birthdate ? birthdate.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setBirthdate(new Date(e.target.value));
                  } else {
                    setBirthdate(null);
                  }
                }}
              />
            ) : (
              <>
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
              </>
            )}

            <View style={styles.locationInfo}>
              <Ionicons
                name={location ? 'location' : 'location-outline'}
                size={18}
                color={location ? COLORS.secondary : COLORS.gray}
              />
              <Text style={[styles.locationText, location && styles.locationActive]}>
                {location ? 'Localisation prête' : 'Acquisition de la position GPS...'}
              </Text>
            </View>

            <Button
              title="Continuer"
              onPress={handleValidateStep1}
              loading={loading}
              style={styles.actionBtn}
            />
          </View>
        )}

        {/* --- ÉTAPE 2 : Validation EmailJS --- */}
        {step === 2 && (
          <View style={styles.form}>
            <View style={styles.centerBox}>
              <View style={styles.iconBg}>
                <Ionicons name="mail-open-outline" size={48} color={COLORS.primary} />
              </View>
              <Text style={styles.stepTitle}>Vérification de l'adresse email</Text>
              <Text style={styles.stepDesc}>
                Saisissez le code PIN à 6 chiffres envoyé sur votre adresse email <Text style={{fontWeight:'700'}}>{email}</Text> :
              </Text>
            </View>

            <Input
              label="Code de vérification"
              value={userCode}
              onChangeText={setUserCode}
              placeholder="Code à 6 chiffres"
              keyboardType="number-pad"
              icon="key-outline"
              maxLength={6}
            />

            <Button
              title="Vérifier le code"
              onPress={handleVerifyCode}
              style={styles.actionBtn}
            />
            
            <TouchableOpacity style={styles.resendBtn} onPress={handleValidateStep1}>
              <Text style={styles.resendText}>Renvoyer le code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- ÉTAPE 3 : Personnalisation du Profil --- */}
        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.sectionHeader}>Créer votre profil</Text>

            {/* Photo de profil obligatoire */}
            <Text style={styles.label}>Photo de profil (Obligatoire)</Text>
            <View style={styles.photoUploadContainer}>
              <TouchableOpacity
                onPress={handleSelectPhoto}
                style={[styles.avatarSelector, profilePhoto && styles.avatarSelectorActive]}
              >
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto.uri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera-outline" size={40} color={COLORS.primary} />
                    <Text style={styles.avatarPlaceholderText}>Ajouter une photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Sélection de Profession */}
            <Text style={styles.label}>Profession / Études</Text>
            <View style={styles.chipsContainer}>
              {PROFESSION_OPTIONS.map((p) => {
                const active = profession === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProfession(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {profession === 'Autre 👤' && (
              <Input
                label="Précisez votre profession"
                value={customProfession}
                onChangeText={setCustomProfession}
                placeholder="Ex: Boulanger, Comptable..."
                icon="briefcase-outline"
              />
            )}

            {/* Curseur de Taille */}
            <View style={{ marginVertical: 16 }}>
              <Text style={styles.label}>Taille : {height} cm</Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={140}
                maximumValue={220}
                step={1}
                value={height}
                onValueChange={(val) => setHeight(val)}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={COLORS.lightGray}
                thumbTintColor={COLORS.primary}
              />
            </View>

            {/* Centres d'intérêt */}
            <Text style={styles.label}>Centres d'intérêt</Text>
            <View style={styles.chipsContainer}>
              {INTEREST_OPTIONS.map((interest) => {
                const active = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Croyances */}
            <Text style={styles.label}>Croyances</Text>
            <View style={styles.chipsContainer}>
              {BELIEF_OPTIONS.map((belief) => {
                const active = selectedBeliefs === belief;
                return (
                  <TouchableOpacity
                    key={belief}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedBeliefs(active ? '' : belief)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {belief}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Style de vie */}
            <Text style={styles.label}>Style de vie</Text>
            <View style={styles.chipsContainer}>
              {LIFESTYLE_OPTIONS.map((lifestyle) => {
                const active = selectedLifestyles.includes(lifestyle);
                return (
                  <TouchableOpacity
                    key={lifestyle}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleLifestyle(lifestyle)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {lifestyle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              title="Finaliser l'inscription"
              onPress={handleFinalSubmit}
              loading={loading}
              style={[styles.actionBtn, { marginTop: 24 }]}
            />
          </View>
        )}
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
    paddingBottom: 60,
  },
  header: {
    marginBottom: 20,
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
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
    marginTop: 4,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 10,
    marginTop: 10,
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
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 6,
  },
  genderBtnActive: {
    backgroundColor: COLORS.primary,
  },
  genderText: {
    fontSize: 15,
    fontWeight: '700',
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
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
  },
  locationText: {
    color: COLORS.gray,
    fontSize: 13,
  },
  locationActive: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  actionBtn: {
    marginTop: 16,
    marginBottom: 10,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
  // Styles Etape 2
  centerBox: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  iconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(241, 62, 147, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 10,
  },
  stepDesc: {
    fontSize: 14.5,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  // Styles Etape 3
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  photoUploadContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarSelector: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray,
  },
  avatarSelectorActive: {
    borderStyle: 'solid',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default SignupScreen;
