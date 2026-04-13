/**
 * Écran Accueil - Swipe de profils (style Tinder)
 * Affiche UNIQUEMENT les profils du genre opposé
 * Boutons Like / Pass avec animation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { haversineDistance } from '../utils/helpers';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import ProfileCard from '../components/ProfileCard';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const { user, profile } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Animation pour le swipe
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  /**
   * Récupère les profils du genre opposé
   * RÈGLE CRITIQUE: Hommes voient UNIQUEMENT les femmes et vice versa
   */
  const fetchProfiles = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Genre opposé
      const oppositeGender = profile.gender === 'MALE' ? 'FEMALE' : 'MALE';

      // Récupérer les profils déjà likés pour les exclure
      const { data: likedData } = await supabase
        .from('likes')
        .select('liked_id')
        .eq('liker_id', user.id);
      const likedIds = (likedData || []).map((l) => l.liked_id);

      // Récupérer les profils du genre opposé (exclure ceux déjà likés)
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('gender', oppositeGender)
        .neq('id', user.id);

      if (likedIds.length > 0) {
        // Exclure les profils déjà likés
        query = query.not('id', 'in', `(${likedIds.join(',')})`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // Calculer la distance pour chaque profil
      const profilesWithDistance = (data || []).map((p) => ({
        ...p,
        distance: haversineDistance(
          profile.latitude,
          profile.longitude,
          p.latitude,
          p.longitude
        ),
      }));

      // Trier par distance (plus proches en premier)
      profilesWithDistance.sort((a, b) => a.distance - b.distance);

      setProfiles(profilesWithDistance);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Erreur chargement profils:', error);
      Alert.alert('Erreur', 'Impossible de charger les profils');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  /**
   * Animation de swipe (gauche = pass, droite = like)
   */
  const animateSwipe = (direction, callback) => {
    const toValue = direction === 'right' ? width + 100 : -width - 100;
    Animated.parallel([
      Animated.timing(swipeAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Réinitialiser l'animation
      swipeAnim.setValue(0);
      opacityAnim.setValue(1);
      callback();
    });
  };

  /**
   * Like un profil
   */
  const handleLike = async () => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    animateSwipe('right', async () => {
      try {
        // Enregistrer le like
        await supabase.from('likes').insert({
          liker_id: user.id,
          liked_id: currentProfile.id,
        });

        // Vérifier le match mutuel
        const { data: mutualLike } = await supabase
          .from('likes')
          .select('id')
          .eq('liker_id', currentProfile.id)
          .eq('liked_id', user.id)
          .single();

        if (mutualLike) {
          Alert.alert('💕 C\'est un Match !', `Vous et ${currentProfile.full_name} vous aimez mutuellement !`);
        }
      } catch (error) {
        // Ignorer l'erreur de doublon
        if (!error.message?.includes('duplicate')) {
          console.error('Erreur like:', error);
        }
      }

      setCurrentIndex((prev) => prev + 1);
    });
  };

  /**
   * Passer un profil
   */
  const handlePass = () => {
    animateSwipe('left', () => {
      setCurrentIndex((prev) => prev + 1);
    });
  };

  // Profil actuel à afficher
  const currentProfile = profiles[currentIndex];

  // État de chargement
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Recherche de profils...</Text>
      </View>
    );
  }

  // Plus de profils disponibles
  if (!currentProfile) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="heart-dislike-outline" size={80} color={COLORS.gray} />
        <Text style={styles.emptyTitle}>Plus de profils</Text>
        <Text style={styles.emptyText}>Revenez plus tard pour découvrir de nouvelles personnes</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfiles}>
          <Ionicons name="refresh" size={20} color={COLORS.white} />
          <Text style={styles.refreshText}>Actualiser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <Text style={styles.headerCount}>
          {profiles.length - currentIndex} profil{profiles.length - currentIndex > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Carte du profil avec animation */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={{
            transform: [{ translateX: swipeAnim }],
            opacity: opacityAnim,
          }}
        >
          <ProfileCard
            profile={currentProfile}
            distance={currentProfile.distance}
          />
        </Animated.View>
      </View>

      {/* Boutons d'action */}
      <View style={styles.actions}>
        {/* Bouton Pass */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.passBtn]}
          onPress={handlePass}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={32} color={COLORS.danger} />
        </TouchableOpacity>

        {/* Bouton Like */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={handleLike}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={32} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 40,
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
  headerCount: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
    gap: 40,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  passBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  likeBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.gray,
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  refreshText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
