/**
 * Écran Profil - Affichage et édition du profil utilisateur
 * Galerie photos (max 6), paramètres, déconnexion
 * Boutons Valider / Annuler personnalisés pour le choix des photos (Android & iOS)
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

  // Nouvel état pour gérer la validation / confirmation manuelle de la photo sélectionnée (iOS & Android)
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [isAvatarUpload, setIsAvatarUpload] = useState(false);

  // Nouvelles informations personnelles
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [height, setHeight] = useState(170);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedBeliefs, setSelectedBeliefs] = useState('');
  const [selectedLifestyles, setSelectedLifestyles] = useState([]);
  const [displayedSubscription, setDisplayedSubscription] = useState(null);

  // Charger les données au montage
  useEffect(() => {
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
        fetchPhotos(userId, myProfile?.avatar_url);
        fetchSubscription(userId);
      }
    } else if (targetUserId) {
      fetchTargetProfile();
    }
  }, [myProfile, user, targetUserId, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile) {
      setDisplayedSubscription(subscription);
    }
  }, [subscription, isOwnProfile]);

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

      try {
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', targetUserId)
          .single();

        if (!subError && subData) {
          setDisplayedSubscription(subData);
        } else {
          setDisplayedSubscription({ tier: 'free' });
        }
      } catch (subErr) {
        setDisplayedSubscription({ tier: 'free' });
      }

      await fetchPhotos(targetUserId, profileData?.avatar_url);
    } catch (error) {
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
      setLoadingPhotos(false);
      return;
    }

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
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', effectiveUid)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setPhotos(finalizePhotos(data));
        setLoadingPhotos(false);
        return;
      }

      const { data: listData, error: listError } = await supabase.storage
        .from('photos')
        .list(effectiveUid, { limit: 100, offset: 0 });

      if (listError) {
        setPhotos(finalizePhotos([]));
        setLoadingPhotos(false);
        return;
      }

      if (listData && listData.length > 0) {
        const items = listData.map((it) => ({
          id: `${effectiveUid}-${it.name}`,
          user_id: effectiveUid,
          url: supabase.storage.from('photos').getPublicUrl(`${effectiveUid}/${it.name}`).data.publicUrl,
          is_profile: it.name.includes('profile_'),
          created_at: it.updated_at || new Date().toISOString(),
          name: it.name,
        }));

        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setPhotos(finalizePhotos(items));
      } else {
        setPhotos(finalizePhotos([]));
      }
    } catch (error) {
      setPhotos(finalizePhotos([]));
    } finally {
      setLoadingPhotos(false);
    }
  };

  /**
   * Ouvre la galerie et place l'image en attente de confirmation via le Modal Custom
   */
  const handleSelectImage = async (forAvatar = false) => {
    if (!forAvatar && photos.length >= 6) {
      Alert.alert('Limite atteinte', 'Maximum 6 photos autorisées sur votre profil');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Désactivé pour utiliser notre Modal custom Valider/Annuler
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    // Placer l'image en attente pour affichage du modal de confirmation
    setIsAvatarUpload(forAvatar);
    setPendingPhoto(result.assets[0]);
  };

  /**
   * Valider et téléverser la photo sélectionnée
   */
  const handleConfirmPhoto = async () => {
    if (!pendingPhoto) return;

    const isProfile = isAvatarUpload || photos.length === 0;
    if (isProfile) setLoadingAvatar(true);

    const file = pendingPhoto;
    setPendingPhoto(null); // Ferme le modal

    try {
      let fileExt = 'jpg';
      let uploadBody;
      let contentType = 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        uploadBody = blob;
        contentType = blob.type || 'image/jpeg';
        const ext = contentType.split('/').pop();
        fileExt = ext === 'jpeg' ? 'jpg' : (ext || 'jpg');
      } else {
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
          const response = await fetch(file.uri);
          uploadBody = await response.blob();
          contentType = uploadBody.type || contentType;
        }
      }

      const fileName = isProfile
        ? `${userId}/profile_${Date.now()}.${fileExt}`
        : `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, uploadBody, { contentType, upsert: false });

      if (uploadError) throw new Error(`Upload Storage: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);

      try {
        if (isProfile) {
          await supabase
            .from('photos')
            .update({ is_profile: false })
            .eq('user_id', userId);
        }

        await supabase
          .from('photos')
          .insert({ user_id: userId, url: urlData.publicUrl, is_profile: isProfile });
      } catch (dbError) {
        console.warn('DB insert/update error:', dbError?.message);
      }

      if (isProfile) {
        await updateProfile({ avatar_url: urlData.publicUrl });
        setProfile((prev) => (prev ? { ...prev, avatar_url: urlData.publicUrl } : null));
      }

      await fetchPhotos(userId, useAuthStore.getState().profile?.avatar_url || urlData.publicUrl);
    } catch (error) {
      Alert.alert('Erreur upload', error.message || "Impossible d'ajouter la photo");
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
              const isStoragePhoto = photoToDelete?.name;

              if (isStoragePhoto) {
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
                if (!userId) throw new Error('Utilisateur non authentifié');
                await supabase.from('photos').delete().eq('id', photoId);
              }

              if (isDeletingProfile) {
                const remainingPhotos = photos.filter((p) => p.id !== photoId);
                const nextProfilePhoto = remainingPhotos[0];

                if (nextProfilePhoto) {
                  if (!nextProfilePhoto.name) {
                    await supabase
                      .from('photos')
                      .update({ is_profile: true })
                      .eq('id', nextProfilePhoto.id);
                  }
                  await updateProfile({ avatar_url: nextProfilePhoto.url });
                  setProfile((prev) => (prev ? { ...prev, avatar_url: nextProfilePhoto.url } : null));
                } else {
                  await updateProfile({ avatar_url: null });
                  setProfile((prev) => (prev ? { ...prev, avatar_url: null } : null));
                }
              }

              setSelectedPhoto(null);
              await fetchPhotos(userId, useAuthStore.getState().profile?.avatar_url);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la photo');
            } finally {
              setLoadingAvatar(false);
            }
          },
        },
      ]
    );
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {!isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={COLORS.black} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, !isOwnProfile && { flex: 1 }]}>
            {isOwnProfile ? 'Mon Profil' : profile?.full_name || 'Profil'}
          </Text>
        </View>
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
              onPress={() => handleSelectImage(true)}
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
              displayedSubscription?.tier === 'vip' && styles.subBadgeVip,
              displayedSubscription?.tier === 'premium' && styles.subBadgePremium,
            ]}
            onPress={() => isOwnProfile && navigation.navigate('Subscription')}
            disabled={!isOwnProfile}
          >
            <Ionicons name="diamond-outline" size={14} color={COLORS.white} />
            <Text style={styles.subBadgeText}>
              {tierLabel[displayedSubscription?.tier] || 'Gratuit'}
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
          {profile?.bio ? (
            <View style={styles.bioSection}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {(profile?.profession ||
            profile?.height ||
            profile?.beliefs ||
            (profile?.interests && profile?.interests.length > 0) ||
            (profile?.lifestyle && profile?.lifestyle.length > 0)) && (
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
          )}
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
                <TouchableOpacity style={styles.addPhotoBtn} onPress={() => handleSelectImage(false)}>
                  <Ionicons name="add" size={32} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        <Text style={styles.photoHint}>
          {isOwnProfile
            ? "Appuyez sur une photo pour l'agrandir ou la supprimer"
            : "Appuyez sur une photo pour l'agrandir"}
        </Text>
      </View>

      {/* MODAL CUSTOM : Confirmation / Validation de la photo (iOS & Android) */}
      <Modal
        visible={pendingPhoto !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPendingPhoto(null)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {isAvatarUpload ? 'Définir comme photo de profil' : 'Aperçu de la photo'}
            </Text>

            {pendingPhoto && (
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={styles.confirmImagePreview}
                resizeMode="cover"
              />
            )}

            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelBtn]}
                onPress={() => setPendingPhoto(null)}
              >
                <Ionicons name="close-circle-outline" size={20} color={COLORS.darkGray} />
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, styles.validateBtn]}
                onPress={handleConfirmPhoto}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.validateBtnText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

          <TouchableOpacity
            style={[styles.actionRow, saving && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={saving}
          >
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

  /* --- Styles du Modal de Confirmation Custom (Valider / Annuler) --- */
  confirmModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 16,
  },
  confirmImagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: COLORS.lightGray,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    color: COLORS.darkGray,
    fontWeight: '700',
    fontSize: 15,
  },
  validateBtn: {
    backgroundColor: COLORS.primary,
  },
  validateBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },

  /* --- Modal Plein Écran --- */
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