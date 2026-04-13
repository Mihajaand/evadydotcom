/**
 * Écran Profil - Affichage et édition du profil utilisateur
 * Galerie photos (max 6), paramètres, déconnexion
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { calculateAge } from '../utils/helpers';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useSubscriptionStore from '../store/subscriptionStore';
import Input from '../components/Input';
import Button from '../components/Button';

const ProfileScreen = ({ navigation }) => {
  const { user, profile, logout, updateProfile } = useAuthStore();
  const { subscription, fetchSubscription } = useSubscriptionStore();

  const [photos, setPhotos] = useState([]);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Charger les données au montage
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
    }
    if (user?.id) {
      fetchPhotos();
      fetchSubscription(user.id);
    }
  }, [profile, user]);

  /**
   * Récupère les photos de l'utilisateur
   */
  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Erreur chargement photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  /**
   * Ajouter une photo (max 6)
   */
  const handleAddPhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Limite atteinte', 'Maximum 6 photos');
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

    try {
      const file = result.assets[0];
      const fileExt = file.uri.split('.').pop().toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Convertir le base64 en ArrayBuffer pour l'upload
      const base64 = file.base64;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, bytes.buffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Enregistrer dans la table photos
      const isProfile = photos.length === 0; // Première photo = photo de profil
      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          user_id: user.id,
          url: urlData.publicUrl,
          is_profile: isProfile,
        });

      if (insertError) throw insertError;

      // Mettre à jour l'avatar si c'est la photo de profil
      if (isProfile) {
        await updateProfile({ avatar_url: urlData.publicUrl });
      }

      await fetchPhotos();
      Alert.alert('Succès', 'Photo ajoutée !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la photo');
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
            try {
              await supabase.from('photos').delete().eq('id', photoId);
              await fetchPhotos();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          },
        },
      ]
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
   * Déconnexion avec confirmation
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
            try {
              await logout();
            } catch (error) {
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
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Ionicons
            name={editing ? 'close' : 'create-outline'}
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Avatar principal */}
      <View style={styles.avatarSection}>
        <Image
          source={
            profile?.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/default-avatar.png')
          }
          style={styles.mainAvatar}
        />
        <Text style={styles.name}>
          {profile?.full_name}{age ? `, ${age} ans` : ''}
        </Text>
        <Text style={styles.gender}>
          {profile?.gender === 'MALE' ? '👨 Homme' : '👩 Femme'}
        </Text>

        {/* Badge abonnement */}
        <TouchableOpacity
          style={[
            styles.subBadge,
            subscription?.tier === 'vip' && styles.subBadgeVip,
            subscription?.tier === 'premium' && styles.subBadgePremium,
          ]}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Ionicons name="diamond-outline" size={14} color={COLORS.white} />
          <Text style={styles.subBadgeText}>
            {tierLabel[subscription?.tier] || 'Gratuit'}
          </Text>
        </TouchableOpacity>
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
          <Button
            title="Sauvegarder"
            onPress={handleSave}
            loading={saving}
          />
        </View>
      )}

      {/* Bio (mode visualisation) */}
      {!editing && profile?.bio ? (
        <View style={styles.bioSection}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* Galerie photos */}
      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
        <View style={styles.photosGrid}>
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              style={styles.photoItem}
              onLongPress={() => handleDeletePhoto(photo.id)}
            >
              <Image source={{ uri: photo.url }} style={styles.photo} />
              {photo.is_profile && (
                <View style={styles.profileBadge}>
                  <Text style={styles.profileBadgeText}>Profil</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Bouton ajouter */}
          {photos.length < 6 && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
              <Ionicons name="add" size={32} color={COLORS.primary} />
              <Text style={styles.addPhotoText}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.photoHint}>Appui long pour supprimer une photo</Text>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        {/* Abonnement */}
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

        {/* Déconnexion */}
        <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
          <View style={styles.actionLeft}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={[styles.actionText, styles.logoutText]}>Déconnexion</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
        </TouchableOpacity>
      </View>
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
});

export default ProfileScreen;
