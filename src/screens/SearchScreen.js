/**
 * Écran Recherche - Filtrer les profils par âge, distance, statut en ligne
 * Affiche UNIQUEMENT les profils du genre opposé
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { haversineDistance, calculateAge, formatDistance } from '../utils/helpers';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import SkeletonSearch from '../components/SkeletonSearch';

const SearchScreen = ({ navigation }) => {
  const { user, profile } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(60);
  const [maxDistance, setMaxDistance] = useState(100); // km
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Récupère les profils du genre opposé
   */
  const fetchProfiles = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const oppositeGender = profile.gender === 'MALE' ? 'FEMALE' : 'MALE';

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('gender', oppositeGender)
        .neq('id', user.id);

      if (error) throw error;

      const profilesWithMeta = (data || []).map((p) => ({
        ...p,
        distance: haversineDistance(
          profile.latitude,
          profile.longitude,
          p.latitude,
          p.longitude
        ),
        age: calculateAge(p.birthdate),
      }));

      setProfiles(profilesWithMeta);
      setFilteredProfiles(profilesWithMeta);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les profils');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  /**
   * Applique les filtres
   */
  useEffect(() => {
    let filtered = [...profiles];

    // Filtre par âge
    filtered = filtered.filter(
      (p) => p.age && p.age >= minAge && p.age <= maxAge
    );

    // Filtre par distance
    filtered = filtered.filter((p) => p.distance <= maxDistance);

    // Filtre en ligne seulement
    if (onlineOnly) {
      filtered = filtered.filter((p) => p.is_online);
    }

    // Trier par distance
    filtered.sort((a, b) => a.distance - b.distance);

    setFilteredProfiles(filtered);
  }, [profiles, minAge, maxAge, maxDistance, onlineOnly]);

  /**
   * Navigation vers le profil complet / chat
   */
  const handleProfilePress = (targetProfile) => {
    navigation.navigate('Chat', {
      partnerId: targetProfile.id,
      partnerName: targetProfile.full_name,
      partnerAvatar: targetProfile.avatar_url,
      partnerGender: targetProfile.gender,
    });
  };

  /**
   * Rendu d'un profil dans la liste
   */
  const renderProfile = ({ item }) => (
    <TouchableOpacity
      style={styles.profileCard}
      onPress={() => handleProfilePress(item)}
      activeOpacity={0.85}
    >
      <Image
        source={
          item.avatar_url
            ? { uri: item.avatar_url }
            : require('../../assets/default-avatar.png')
        }
        style={styles.avatar}
      />

      {/* Badge en ligne */}
      {item.is_online && <View style={styles.onlineDot} />}

      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {item.full_name}{item.age ? `, ${item.age}` : ''}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.gray} />
          <Text style={styles.metaText}>{formatDistance(item.distance)}</Text>
        </View>
        {item.bio ? (
          <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recherche</Text>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={22} color={COLORS.primary} />
          <Text style={styles.filterToggleText}>Filtres</Text>
        </TouchableOpacity>
      </View>

      {/* Panel de filtres */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Filtre par âge */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Âge: {minAge} - {maxAge} ans</Text>
            <View style={styles.ageButtons}>
              <TouchableOpacity
                style={styles.ageBtn}
                onPress={() => setMinAge(Math.max(18, minAge - 1))}
              >
                <Text style={styles.ageBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.ageValue}>{minAge}</Text>
              <TouchableOpacity
                style={styles.ageBtn}
                onPress={() => setMinAge(Math.min(maxAge - 1, minAge + 1))}
              >
                <Text style={styles.ageBtnText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.ageSeparator}>à</Text>
              <TouchableOpacity
                style={styles.ageBtn}
                onPress={() => setMaxAge(Math.max(minAge + 1, maxAge - 1))}
              >
                <Text style={styles.ageBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.ageValue}>{maxAge}</Text>
              <TouchableOpacity
                style={styles.ageBtn}
                onPress={() => setMaxAge(Math.min(99, maxAge + 1))}
              >
                <Text style={styles.ageBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filtre par distance */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Distance max: {maxDistance} km</Text>
            <View style={styles.distanceBtns}>
              {[1000, 2500, 5000, 10000, 20000].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.distanceChip,
                    maxDistance === d && styles.distanceChipActive,
                  ]}
                  onPress={() => setMaxDistance(d)}
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      maxDistance === d && styles.distanceChipTextActive,
                    ]}
                  >
                    {d} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filtre en ligne */}
          <TouchableOpacity
            style={styles.onlineFilter}
            onPress={() => setOnlineOnly(!onlineOnly)}
          >
            <Ionicons
              name={onlineOnly ? 'checkbox' : 'square-outline'}
              size={22}
              color={COLORS.primary}
            />
            <Text style={styles.onlineFilterText}>En ligne uniquement</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Résultats */}
      <Text style={styles.resultCount}>
        {filteredProfiles.length} résultat{filteredProfiles.length > 1 ? 's' : ''}
      </Text>

      {loading ? (
        <SkeletonSearch />
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          renderItem={renderProfile}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={60} color={COLORS.gray} />
              <Text style={styles.emptyText}>Aucun profil trouvé</Text>
              <Text style={styles.emptySubtext}>Essayez d'élargir vos filtres</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterToggleText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  filtersPanel: {
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  ageButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  ageBtnText: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '700',
  },
  ageValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    minWidth: 30,
    textAlign: 'center',
  },
  ageSeparator: {
    fontSize: 14,
    color: COLORS.gray,
    marginHorizontal: 4,
  },
  distanceBtns: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  distanceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  distanceChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  distanceChipText: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  distanceChipTextActive: {
    color: COLORS.white,
  },
  onlineFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineFilterText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '600',
  },
  resultCount: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.lightGray,
  },
  onlineDot: {
    position: 'absolute',
    left: 56,
    top: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.secondary,
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 1,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  bio: {
    fontSize: 13,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
});

export default SearchScreen;
