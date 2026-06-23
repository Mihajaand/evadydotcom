/**
 * Écran Profil - Affichage et édition du profil utilisateur
 * Galerie photos (max 6), paramètres, déconnexion
 * Enrichi avec les informations personnelles (Taille, Profession, Croyances, Centres d'intérêt, Style de vie)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { customAlert } from '../utils/helpers';

const Alert = {
  alert: customAlert,
};
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { COLORS } from '../utils/constants';
import { calculateAge } from '../utils/helpers';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useSubscriptionStore from '../store/subscriptionStore';
import Input from '../components/Input';
import Button from '../components/Button';
import SkeletonPhotos from '../components/SkeletonPhotos';

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

const ProfileScreen = ({ route, navigation }) => {
  const { user, profile: myProfile, logout, updateProfile } = useAuthStore();
  const { subscription, fetchSubscription } = useSubscriptionStore();

  const targetUserId = route?.params?.userId;
  const userId = user?.id || myProfile?.id;
  const isOwnProfile = !targetUserId || targetUserId === userId;

  const [profile, setProfile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  // Nouvelles informations personnelles
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [height, setHeight] = useState(170);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedBeliefs, setSelectedBeliefs] = useState('');
  const [selectedLifestyles, setSelectedLifestyles] = useState([]);

  // Charger les données au montage
  useEffect(() => {
    console.log('ProfileScreen useEffect:', { isOwnProfile, hasUser: !!userId, hasMyProfile: !!myProfile, targetUserId });
    if (isOwnProfile) {
      if (myProfile) {
        setProfile(myProfile);
        setFullName(myProfile.full_name || '');
        setBio(myProfile.bio || '');
        if (myProfile.profession) {
          if (PROFESSION_OPTIONS.includes(myProfile.profession)) {
            setProfession(myProfile.profession);
            setCustomProfession('');
          } else {
            setProfession('Autre 👤');
            setCustomProfession(myProfile.profession);
          }
        } else {
          setProfession('');
          setCustomProfession('');
        }
        setHeight(myProfile.height ? parseInt(myProfile.height.replace(' cm', '')) : 170);
        setSelectedInterests(myProfile.interests || []);
        setSelectedBeliefs(myProfile.beliefs || '');
        setSelectedLifestyles(myProfile.lifestyle || []);
      }
      if (userId) {
        console.log('ProfileScreen: Appel fetchPhotos avec userId=', userId);
        fetchPhotos(userId, myProfile?.avatar_url);
        fetchSubscription(userId);
      } else {
        console.warn('ProfileScreen: userId non disponible, photos non chargées');
      }
    } else if (targetUserId) {
      console.log('ProfileScreen: Appel fetchTargetProfile pour userId=', targetUserId);
      fetchTargetProfile();
    }
  }, [myProfile, user, targetUserId, isOwnProfile]);

  const fetchTargetProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setFullName(profileData.full_name || '');
      setBio(profileData.bio || '');
      if (profileData.profession) {
        if (PROFESSION_OPTIONS.includes(profileData.profession)) {
          setProfession(profileData.profession);
          setCustomProfession('');
        } else {
          setProfession('Autre 👤');
          setCustomProfession(profileData.profession);
        }
      } else {
        setProfession('');
        setCustomProfession('');
      }
      setHeight(profileData.height ? parseInt(profileData.height.replace(' cm', '')) : 170);
      setSelectedInterests(profileData.interests || []);
      setSelectedBeliefs(profileData.beliefs || '');
      setSelectedLifestyles(profileData.lifestyle || []);

      // Charger les photos en utilisant la même logique que fetchPhotos (DB puis Storage)
      await fetchPhotos(targetUserId, profileData?.avatar_url);
    } catch (error) {
      console.error('Erreur chargement profil tiers:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil.');
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  /**
   * Récupère les photos de l'utilisateur
   */
  const fetchPhotos = async (uid, currentAvatarUrl = null) => {
    setLoadingPhotos(true);
    const effectiveUid = uid || userId;
    if (!effectiveUid) {
      console.warn('fetchPhotos: effectiveUid est undefined', { uid, userId: userId });
      setLoadingPhotos(false);
      return;
    }
    console.log('fetchPhotos: Démarrage pour userId=', effectiveUid);

    const activeAvatar = currentAvatarUrl || profile?.avatar_url || myProfile?.avatar_url;

    const finalizePhotos = (items) => {
      let updated = [...items];
      if (activeAvatar) {
        const hasProfile = updated.some(p => p.url === activeAvatar || p.is_profile);
        if (!hasProfile) {
          updated.unshift({
            id: `profile-${effectiveUid}-${Date.now()}`,
            user_id: effectiveUid,
            url: activeAvatar,
            is_profile: true,
            created_at: new Date().toISOString(),
          });
        } else {
          updated = updated.map(p => {
            if (p.url === activeAvatar) {
              return { ...p, is_profile: true };
            }
            if (p.url !== activeAvatar && p.is_profile) {
              return { ...p, is_profile: false };
            }
            return p;
          });
        }
      }
      return updated.slice(0, 6);
    };

    try {
      // Essayer d'abord la table photos via la requête directe
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', effectiveUid)
        .order('created_at', { ascending: false });

      console.log('fetchPhotos: Résultat DB -', { error: error?.message, dataCount: data?.length || 0 });

      // Si la table est vide ou bloquée par RLS, utiliser le Storage comme fallback
      console.warn('fetchPhotos: Table vide ou inaccessible, essai fallback Storage:', { error: error?.message });
      
      const { data: listData, error: listError } = await supabase.storage
        .from('photos')
        .list(effectiveUid, { limit: 100, offset: 0 });

      console.log('fetchPhotos: Résultat Storage list -', { error: listError?.message, fileCount: listData?.length || 0 });

      if (listError) {
        console.error('fetchPhotos: Erreur critique Storage list:', { error: listError?.message, status: listError?.status });
        setPhotos(finalizePhotos([]));
        setLoadingPhotos(false);
        return;
      }

      if (listData && listData.length > 0) {
        console.log('fetchPhotos: Construction URLs pour', listData.length, 'fichiers');
        // Construire les URLs publiques et les métadonnées
        const items = listData.map((it, index) => ({
          id: `${effectiveUid}-${it.name}`, // ID unique basé sur user + fileName
          user_id: effectiveUid,
          url: supabase.storage.from('photos').getPublicUrl(`${effectiveUid}/${it.name}`).data.publicUrl,
          is_profile: it.name.includes('profile_'),
          created_at: it.updated_at || new Date().toISOString(),
          name: it.name,
        }));
        
        // Trier les éléments du stockage par date décroissante (les plus récents en premier)
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        console.log('fetchPhotos: Succès, photos chargées=', items.map(it => it.name));
        setPhotos(finalizePhotos(items));
      } else {
        console.warn('fetchPhotos: Pas de fichiers trouvés en Storage');
        setPhotos(finalizePhotos([]));
      }
    } catch (error) {
      console.error('fetchPhotos: Exception critique:', { message: error?.message, code: error?.code });
      setPhotos(finalizePhotos([]));
    } finally {
      setLoadingPhotos(false);
    }
  };

  /**
   * Ajouter une photo (max 6)
   */
  const handleAddPhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Limite atteinte', 'Maximum 6 photos autorisées sur votre profil');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Session invalide. Veuillez vous reconnecter et réessayer.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    const isProfile = photos.length === 0;
    if (isProfile) setLoadingAvatar(true);

    try {
      const file = result.assets[0];
      let fileExt = 'jpg';
      let uploadBody;
      let contentType = 'image/jpeg';

      if (Platform.OS === 'web') {
        // Web : récupérer le blob directement depuis l'URI
        const response = await fetch(file.uri);
        const blob = await response.blob();
        uploadBody = blob;
        contentType = blob.type || 'image/jpeg';
        const ext = contentType.split('/').pop();
        fileExt = ext === 'jpeg' ? 'jpg' : (ext || 'jpg');
      } else {
        // Mobile : utiliser le base64 fourni par ImagePicker
        const uriParts = file.uri.split('.');
        fileExt = uriParts[uriParts.length - 1].toLowerCase().split('?')[0] || 'jpg';
        contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

        if (file.base64) {
          const byteCharacters = atob(file.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          uploadBody = new Uint8Array(byteNumbers);
        } else {
          // Fallback : fetch blob si pas de base64
          const response = await fetch(file.uri);
          uploadBody = await response.blob();
          contentType = uploadBody.type || contentType;
        }
      }

      // Ajouter le préfixe 'profile_' si c'est la première photo
      const fileName = isProfile 
        ? `${userId}/profile_${Date.now()}.${fileExt}`
        : `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, uploadBody, { contentType, upsert: false });

      if (uploadError) throw new Error(`Upload Storage: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);

      try {
        // Essayer d'insérer dans la table DB
        const { error: insertError } = await supabase
          .from('photos')
          .insert({ user_id: userId, url: urlData.publicUrl, is_profile: isProfile });

        if (insertError) {
          console.warn('Insert DB error (RLS may apply):', insertError?.message);
          // Continuer même si RLS bloque, la photo est uploadée au storage
        }
      } catch (dbError) {
        console.warn('DB insert failed:', dbError?.message);
      }

      if (isProfile) {
        await updateProfile({ avatar_url: urlData.publicUrl });
        setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      }

      await fetchPhotos(userId, useAuthStore.getState().profile?.avatar_url || urlData.publicUrl);
    } catch (error) {
      console.error('Erreur handleAddPhoto:', error);
      Alert.alert('Erreur upload', error.message || 'Impossible d\'ajouter la photo');
    } finally {
      setLoadingAvatar(false);
    }
  };

  /**
   * Modifier directement la photo de profil depuis le bouton de l'avatar principal
   */
  const handleUploadProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    if (!user?.id) {
      Alert.alert('Erreur', 'Session invalide. Veuillez vous reconnecter et réessayer.');
      return;
    }

    setLoadingAvatar(true);
    try {
      const file = result.assets[0];
      let fileExt = 'jpg';
      let uploadBody;
      let contentType = 'image/jpeg';

      if (Platform.OS === 'web') {
        // Web : récupérer le blob directement depuis l'URI
        const response = await fetch(file.uri);
        const blob = await response.blob();
        uploadBody = blob;
        contentType = blob.type || 'image/jpeg';
        const ext = contentType.split('/').pop();
        fileExt = ext === 'jpeg' ? 'jpg' : (ext || 'jpg');
      } else {
        // Mobile : utiliser le base64 fourni par ImagePicker
        const uriParts = file.uri.split('.');
        fileExt = uriParts[uriParts.length - 1].toLowerCase().split('?')[0] || 'jpg';
        contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

        if (file.base64) {
          const byteCharacters = atob(file.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          uploadBody = new Uint8Array(byteNumbers);
        } else {
          // Fallback : fetch blob si pas de base64
          const response = await fetch(file.uri);
          uploadBody = await response.blob();
          contentType = uploadBody.type || contentType;
        }
      }

      const fileName = `${userId}/profile_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, uploadBody, { contentType, upsert: false });

      if (uploadError) throw new Error(`Upload Storage: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);

      try {
        // Désactiver toutes les autres photos de profil
        const { error: updateError } = await supabase
          .from('photos')
          .update({ is_profile: false })
          .eq('user_id', userId);

        if (updateError) {
          console.warn('Update DB error:', updateError?.message);
        }

      if (insertError) {
        if (String(insertError.message || '').toLowerCase().includes('row-level security')) {
          Alert.alert('Autorisation refusée', "Impossible de modifier la photo de profil: la politique RLS empêche l'insertion. Vérifiez la session ou les policies Supabase.");
        }
        throw new Error(`Insert DB: ${insertError.message}`);
      }

        if (insertError) {
          console.warn('Insert DB error:', insertError?.message);
        }
      } catch (dbError) {
        console.error('DB operation error (RLS may apply):', dbError);
        // Continuer même si RLS bloque, l'avatar sera mis à jour
      }

      // Mettre à jour l'avatar quoiqu'il arrive (même si RLS a bloqué l'insert)
      await updateProfile({ avatar_url: urlData.publicUrl });
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      await fetchPhotos(userId, urlData.publicUrl);
    } catch (error) {
      console.error('Erreur handleUploadProfilePhoto:', error);
      Alert.alert('Erreur upload', error.message || 'Impossible de modifier la photo de profil');
    } finally {
      setLoadingAvatar(false);
    }
  };

  /**
   * Supprimer une photo
   */
  const handleDeletePhoto = (photoId) => {
    Alert.alert(
      'Supprimer la photo',
      'Êtes-vous sûr de vouloir supprimer cette photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const photoToDelete = photos.find((p) => p.id === photoId);
            const isDeletingProfile = photoToDelete?.is_profile;

            if (isDeletingProfile) {
              setLoadingAvatar(true);
            }

            try {
              // Vérifier si c'est une photo de la table DB ou du storage
              const isStoragePhoto = photoToDelete?.name; // Les photos du storage ont une propriété 'name'

              if (isStoragePhoto) {
                // Supprimer du storage (utiliser user_id de la photo si disponible)
                const ownerId = photoToDelete.user_id || userId;
                if (ownerId) {
                  const filePath = `${ownerId}/${photoToDelete.name}`;
                  try {
                    await supabase.storage.from('photos').remove([filePath]);
                  } catch (remErr) {
                    console.warn('Erreur suppression storage:', remErr?.message || remErr);
                  }
                }
              } else {
                // Supprimer de la table DB
                if (!userId) throw new Error('Utilisateur non authentifié');
                await supabase.from('photos').delete().eq('id', photoId);
              }
              
              if (isDeletingProfile) {
                const remainingPhotos = photos.filter((p) => p.id !== photoId);
                const nextProfilePhoto = remainingPhotos[0];

                if (nextProfilePhoto) {
                  // Si on a une photo restante, la mettre comme profil
                  if (!nextProfilePhoto.name) {
                    // Photo de la table DB
                    await supabase
                      .from('photos')
                      .update({ is_profile: true })
                      .eq('id', nextProfilePhoto.id);
                  }
                  await updateProfile({ avatar_url: nextProfilePhoto.url });
                  setProfile(prev => prev ? { ...prev, avatar_url: nextProfilePhoto.url } : null);
                } else {
                  // Aucune photo restante
                  await updateProfile({ avatar_url: null });
                  setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
                }
              }

              setSelectedPhoto(null);
              await fetchPhotos(userId, useAuthStore.getState().profile?.avatar_url);
            } catch (error) {
              console.error('Erreur suppression photo:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la photo');
            } finally {
              setLoadingAvatar(false);
            }
          },
        },
      ]
    );
  };

  // Gestion des Tags en mode édition
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
   * Sauvegarder les modifications du profil
   */
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
        profession: profession === 'Autre 👤' ? customProfession.trim() : profession,
        height: height ? `${height} cm` : null,
        interests: selectedInterests,
        beliefs: selectedBeliefs,
        lifestyle: selectedLifestyles,
      });
      setEditing(false);
      Alert.alert('Succès', 'Profil mis à jour !');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Déconnexion
   */
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await new Promise((resolve) => setTimeout(resolve, 800));
              await logout();
            } catch (error) {
              setSaving(false);
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const age = calculateAge(profile?.birthdate);
  const tierLabel = {
    free: 'Gratuit',
    basic: 'Basic',
    premium: 'Premium',
    vip: 'VIP',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* En-tête profil */}
      <View style={styles.header}>
        {!isOwnProfile && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, !isOwnProfile && { flex: 1 }]}>
          {isOwnProfile ? 'Mon Profil' : (profile?.full_name || 'Profil')}
        </Text>
        {isOwnProfile && (
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Ionicons
              name={editing ? 'close' : 'create-outline'}
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar principal */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          {loadingAvatar ? (
            <View style={styles.avatarLoadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <Image
              source={
                profile?.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/default-avatar.png')
              }
              style={styles.mainAvatar}
            />
          )}
          {isOwnProfile && (
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handleUploadProfilePhoto}
              disabled={loadingAvatar}
            >
              <Ionicons name="camera" size={20} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.name}>
          {profile?.full_name}{age ? `, ${age} ans` : ''}
        </Text>
        <Text style={styles.gender}>
          {profile?.gender === 'MALE' ? '👨 Homme' : '👩 Femme'}
        </Text>

        {profile?.gender === 'MALE' && (
          <TouchableOpacity
            style={[
              styles.subBadge,
              subscription?.tier === 'vip' && styles.subBadgeVip,
              subscription?.tier === 'premium' && styles.subBadgePremium,
            ]}
            onPress={() => isOwnProfile && navigation.navigate('Subscription')}
            disabled={!isOwnProfile}
          >
            <Ionicons name="diamond-outline" size={14} color={COLORS.white} />
            <Text style={styles.subBadgeText}>
              {tierLabel[subscription?.tier] || 'Gratuit'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mode édition */}
      {editing && (
        <View style={styles.editSection}>
          <Input
            label="Nom complet"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />
          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Parlez de vous..."
            multiline
            icon="text-outline"
          />
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

          {/* Séléctions de Tags en mode Édition */}
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
            title="Sauvegarder"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: 16 }}
          />
        </View>
      )}

      {/* Mode Visualisation */}
      {!editing && (
        <View>
          {/* Bio */}
          {profile?.bio ? (
            <View style={styles.bioSection}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Caractéristiques Personnelles */}
          {(profile?.profession || profile?.height || profile?.beliefs || (profile?.interests && profile?.interests.length > 0) || (profile?.lifestyle && profile?.lifestyle.length > 0)) ? (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
              
              <View style={styles.infoRowGrid}>
                {profile?.height ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="resize-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.infoBadgeText}>{profile.height}</Text>
                  </View>
                ) : null}
                
                {profile?.profession ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="briefcase-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.infoBadgeText}>{profile.profession}</Text>
                  </View>
                ) : null}

                {profile?.beliefs ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="bookmark-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.infoBadgeText}>{profile.beliefs}</Text>
                  </View>
                ) : null}
              </View>

              {profile?.interests && profile.interests.length > 0 ? (
                <View style={styles.tagsGroup}>
                  <Text style={styles.subSectionTitle}>Centres d'intérêt</Text>
                  <View style={styles.tagsContainer}>
                    {profile.interests.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {profile?.lifestyle && profile.lifestyle.length > 0 ? (
                <View style={styles.tagsGroup}>
                  <Text style={styles.subSectionTitle}>Style de vie</Text>
                  <View style={styles.tagsContainer}>
                    {profile.lifestyle.map((tag) => (
                      <View key={tag} style={[styles.tagChip, styles.lifestyleTagBg]}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Galerie photos */}
      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
        <View style={styles.photosGrid}>
          {loadingPhotos ? (
            <SkeletonPhotos />
          ) : (
            <>
              {photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.url }} style={styles.photo} />
                  {photo.is_profile && (
                    <View style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>Profil</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {isOwnProfile && photos.length < 6 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                  <Ionicons name="add" size={32} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        <Text style={styles.photoHint}>
          {isOwnProfile ? "Appuyez sur une photo pour l'agrandir ou la supprimer" : "Appuyez sur une photo pour l'agrandir"}
        </Text>
      </View>

      {/* Modal de visualisation de photo en plein écran */}
      <Modal
        visible={selectedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {isOwnProfile && (
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={() => {
                  if (selectedPhoto) {
                    handleDeletePhoto(selectedPhoto.id);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>

          {selectedPhoto && (
            <View style={styles.modalImageContainer}>
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              {selectedPhoto.is_profile && (
                <View style={styles.modalProfileBadge}>
                  <Text style={styles.modalProfileBadgeText}>Photo de Profil</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Actions */}
      {isOwnProfile && (
        <View style={styles.actionsSection}>
          {profile?.gender === 'MALE' && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="diamond-outline" size={22} color={COLORS.primary} />
                <Text style={styles.actionText}>Mon abonnement</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.actionRow, saving && styles.logoutButtonDisabled]} onPress={handleLogout} disabled={saving}>
            <View style={styles.actionLeft}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
              <Text style={[styles.actionText, styles.logoutText]}>Déconnexion</Text>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.black,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarLoadingContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightGray,
    borderWidth: 3,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mainAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightGray,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.black,
    marginTop: 12,
  },
  gender: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  subBadgeVip: {
    backgroundColor: '#FFD700',
  },
  subBadgePremium: {
    backgroundColor: COLORS.primary,
  },
  subBadgeText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  editSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 10,
    marginTop: 16,
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    color: COLORS.darkGray,
    lineHeight: 22,
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  infoRowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  infoBadgeText: {
    fontSize: 14,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  tagsGroup: {
    marginTop: 14,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(241, 62, 147, 0.08)',
  },
  lifestyleTagBg: {
    backgroundColor: 'rgba(0, 149, 246, 0.08)',
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
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
  photosSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
  },
  profileBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  profileBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  addPhotoBtn: {
    width: '31%',
    aspectRatio: 0.75,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  photoHint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalProfileBadge: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalProfileBadgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  logoutText: {
    color: COLORS.danger,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
});

export default ProfileScreen;
