/**
 * Composant ProfileCard - Carte de profil swipeable (style Tinder)
 * Affiche la photo, le nom, l'âge, la distance et la bio
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { calculateAge, formatDistance } from '../utils/helpers';

const { width, height } = Dimensions.get('window');

/**
 * @name CARD_DIMENSIONS
 * @description Jdoc : Dimensions de la carte de profil.
 * CARD_WIDTH est étendu à 94% de la largeur et CARD_HEIGHT à 74% de la hauteur
 * pour que l'image de profil couvre majestueusement la majeure partie de la page.
 **/
const CARD_WIDTH = width * 0.94;
const CARD_HEIGHT = height * 0.74;

const ProfileCard = ({ profile, distance }) => {
  if (!profile) return null;

  const age = calculateAge(profile.birthdate);

  return (
    <View style={styles.card}>
      {/* Photo de profil */}
      <Image
        source={
          profile.avatar_url
            ? { uri: profile.avatar_url }
            : require('../../assets/default-avatar.png')
        }
        style={styles.image}
        resizeMode="cover"
      />

      {/* Badge Abonnement Homme (top right) */}
      {profile.gender === 'MALE' && (
        <View style={[styles.subBadge, styles[`subBadge_${profile.subscriptionTier || 'free'}`]]}>
          <Ionicons name="sparkles" size={12} color={COLORS.white} style={{ marginRight: 4 }} />
          <Text style={styles.subBadgeText}>
            {(profile.subscriptionTier || 'free').toUpperCase()}
          </Text>
        </View>
      )}

      {/* Overlay dégradé en bas */}
      <View style={styles.overlay}>
        {/* Badge en ligne */}
        {profile.is_online && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En ligne</Text>
          </View>
        )}

        {/* Nom + Âge */}
        <Text style={styles.name}>
          {profile.full_name}{age ? `, ${age}` : ''}
        </Text>

        {/* Distance */}
        {distance !== undefined && (
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.white} />
            <Text style={styles.distanceText}>
              {formatDistance(distance)}
            </Text>
          </View>
        )}

        {/* Bio */}
        {profile.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'transparent',
    // Dégradé simulé avec overlay
    backgroundImage: undefined,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(93, 211, 182, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 6,
  },
  onlineText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distanceText: {
    color: COLORS.white,
    fontSize: 14,
    marginLeft: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bio: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 99,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  subBadge_free: {
    backgroundColor: '#7E8A96',
  },
  subBadge_basic: {
    backgroundColor: '#3b82f6',
  },
  subBadge_premium: {
    backgroundColor: COLORS.primary,
  },
  subBadge_vip: {
    backgroundColor: '#D4AF37',
  },
  subBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default ProfileCard;
