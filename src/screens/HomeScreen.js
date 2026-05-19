/**
 * Écran Accueil - Swipe de profils (style Tinder) avec Map View et Géolocalisation
 * 
 * RÈGLES CRITIQUES:
 * - Affiche UNIQUEMENT les profils du genre opposé
 * - GPS : Calcule la distance par rapport aux coordonnées temps réel (useLocation.js)
 * - Swipe tactile : Glissé de cartes Tinder avec rotation 3D premium
 * - Map : Visualisation géographique interactive des profils alentour
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
  PanResponder, // MODIFICATION : Ajout pour gérer le glissement tactile Tinder
  Image, // MODIFICATION : Ajout pour les avatars sur la carte
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout } from 'react-native-maps'; // MODIFICATION : Intégration de la carte interactive
import { COLORS } from '../utils/constants';
import { haversineDistance, calculateAge, formatDistance } from '../utils/helpers'; // MODIFICATION : Import des helpers d'âge et formatage
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import ProfileCard from '../components/ProfileCard';
import useLocation from '../hooks/useLocation'; // MODIFICATION : Import du hook GPS

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const { user, profile } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // MODIFICATION : 'card' (glissé Tinder) ou 'map' (carte géographique)

  /**
   * @name currentProfile
   * @description Jdoc: Candidat de profil recommandé actif à l'index courant.
   **/
  const currentProfile = profiles[currentIndex];

  // AJOUT : États et Refs pour la micro-animation des petits cœurs qui s'envolent
  const [flyingHearts, setFlyingHearts] = useState([]);
  const likeBtnScale = useRef(new Animated.Value(1)).current;

  /**
   * @name spawnHearts
   * @description Jdoc: Spawne plusieurs petits cœurs à des positions horizontales et échelles aléatoires,
   * puis les anime en élévation et opacité progressive avant de les retirer du state.
   **/
  const spawnHearts = () => {
    const newHearts = Array.from({ length: 6 }).map((_, index) => {
      const id = Date.now() + index + Math.random();
      const anim = new Animated.Value(0);

      Animated.timing(anim, {
        toValue: 1,
        duration: 900 + Math.random() * 400,
        useNativeDriver: true,
      }).start(() => {
        setFlyingHearts((prev) => prev.filter((h) => h.id !== id));
      });

      return {
        id,
        anim,
        x: -40 + Math.random() * 80, // dispersion horizontale aléatoire
        scale: 0.6 + Math.random() * 0.7, // taille aléatoire
      };
    });

    setFlyingHearts((prev) => [...prev, ...newHearts]);
  };

  // MODIFICATION : Récupération des coordonnées GPS en temps réel via le hook useLocation
  const { location: gpsLocation, errorMsg: locationError, loading: loadingLocation } = useLocation();

  // Coordonnées utilisateur (GPS réel ou fallback profil, sinon Paris)
  const userLat = gpsLocation?.latitude || profile?.latitude || 48.8566;
  const userLng = gpsLocation?.longitude || profile?.longitude || 2.3522;

  // MODIFICATION : Coordonnées de déplacement XY pour le glissé tactile
  const pan = useRef(new Animated.ValueXY()).current;

  // MODIFICATION : Synchronise les coordonnées GPS réelles de l'utilisateur dans Supabase
  useEffect(() => {
    if (gpsLocation && user?.id) {
      supabase
        .from('profiles')
        .update({
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
        })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Erreur mise à jour position GPS en BD:', error);
        });
    }
  }, [gpsLocation, user?.id]);

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

      // MODIFICATION : Calculer la distance relative à la position GPS réelle
      const profilesWithDistance = (data || []).map((p) => ({
        ...p,
        distance: haversineDistance(
          userLat,
          userLng,
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
  }, [profile, user, userLat, userLng]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // MODIFICATION : Interpollation de la rotation 3D de la carte Tinder
  const rotate = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  // MODIFICATION : Opacité progressive des badges PASS/SUIVANT lors du glissé
  const nextOpacity = pan.x.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-120, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animatedCardStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { rotate: rotate },
    ],
  };

  // MODIFICATION : Traitement de l'action de Like après swipe
  const handleLikeSwipe = async () => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    pan.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);

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
      if (!error.message?.includes('duplicate')) {
        console.error('Erreur like:', error);
      }
    }
  };

  // MODIFICATION : Traitement de l'action de Pass après swipe
  const handlePassSwipe = () => {
    pan.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
  };

  // MODIFICATION : Déclencheurs d'animation pour les clics boutons du bas
  const triggerLike = () => {
    Animated.timing(pan, {
      toValue: { x: width + 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      handleLikeSwipe();
    });
  };

  const triggerPass = () => {
    Animated.timing(pan, {
      toValue: { x: -width - 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      handlePassSwipe();
    });
  };

  /**
   * @name handleLike
   * @description Jdoc: Déclenche l'animation de squeeze-bounce du bouton flottant,
   * lance l'envolée des petits cœurs, puis après un délai de 600ms, swipe la carte vers la droite pour liker.
   **/
  const handleLike = () => {
    // 1. Animation de rebond tactile sur le bouton (effet squeeze & scale bounce)
    Animated.sequence([
      Animated.timing(likeBtnScale, {
        toValue: 0.82,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(likeBtnScale, {
        toValue: 1.25,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(likeBtnScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Générer l'envolée de cœurs volants
    spawnHearts();

    // 3. Déclencher le swipe physique de la carte vers la droite après 600ms de plaisir visuel
    setTimeout(() => {
      triggerLike();
    }, 600);
  };

  const handlePass = () => {
    triggerPass();
  };

  /**
   * @name panResponder
   * @description Jdoc : PanResponder gérant les gestes de glissement Tinder.
   * Modifié de sorte que le glissement tactile (gauche ou droite) effectue UNIQUEMENT une action de PASS (Suivant),
   * le bouton J'adore flottant étant la seule option pour liker et matcher.
   **/
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx > 120) {
          // MODIFICATION : Glissement vers la droite est désormais un PASS (Suivant)
          Animated.timing(pan, {
            toValue: { x: width + 100, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handlePassSwipe();
          });
        } else if (gestureState.dx < -120) {
          // Glissement vers la gauche reste également un PASS
          Animated.timing(pan, {
            toValue: { x: -width - 100, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handlePassSwipe();
          });
        } else {
          // Retour au centre s'il n'y a pas assez de glissement
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // MODIFICATION : Action de sélection de profil depuis la carte (Callout)
  const handleMarkerPress = (p) => {
    const idx = profiles.findIndex((profile) => profile.id === p.id);
    if (idx !== -1) {
      setCurrentIndex(idx);
      setViewMode('card'); // Repasse sur l'onglet découverte sur ce profil !
    }
  };

  /**
   * @name mapRegion
   * @description Jdoc: Coordonnées de centrage de la carte géographique.
   * Si un profil recommandé (currentProfile) est actif, la carte cible directement sa position,
   * sinon elle se focalise par défaut sur la position GPS de l'utilisateur.
   **/
  const mapRegion = {
    latitude: currentProfile?.latitude || userLat,
    longitude: currentProfile?.longitude || userLng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.04,
  };

  /**
   * @name isDataLoading
   * @description Jdoc: État de chargement global combiné (GPS + profil utilisateur + profils candidats).
   * Reste actif tant que l'une des trois étapes est en cours de récupération pour éviter les flashs d'interface.
   **/
  const isDataLoading = loading || !profile || loadingLocation;

  /**
   * @name loadingOverlay
   * @description Jdoc: Rendu de l'écran de chargement plein écran translucide premium.
   * Se superpose à toute l'application avec un effet de fond opaque et transparent agréable.
   **/
  if (isDataLoading) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingOverlayText}>Recherche de profils à proximité...</Text>
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

      {/* AJOUT : Sélecteur de mode de vue Découverte / Carte géographique */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'card' && styles.toggleActive]}
          onPress={() => setViewMode('card')}
          activeOpacity={0.8}
        >
          <Ionicons name="albums-outline" size={18} color={viewMode === 'card' ? COLORS.white : COLORS.gray} />
          <Text style={[styles.toggleText, viewMode === 'card' && styles.toggleTextActive]}>Découverte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'map' && styles.toggleActive]}
          onPress={() => setViewMode('map')}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={18} color={viewMode === 'map' ? COLORS.white : COLORS.gray} />
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Carte</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'card' ? (
        <>
          {/* Carte du profil avec animation Tinder */}
          <View style={styles.cardContainer}>
            {/* AJOUT : Carte du dessous (prochain profil en 3D deck) */}
            {currentIndex + 1 < profiles.length && (
              <View style={styles.cardUnderneath}>
                <ProfileCard
                  profile={profiles[currentIndex + 1]}
                  distance={profiles[currentIndex + 1].distance}
                />
              </View>
            )}

            {/* Carte principale (au dessus) avec gestionnaires PanResponder */}
            <Animated.View
              {...panResponder.panHandlers}
              style={[animatedCardStyle, styles.cardTop]}
            >
              <ProfileCard
                profile={currentProfile}
                distance={currentProfile.distance}
              />

              {/**
               * @name likeBtnContainer
               * @description Jdoc: Conteneur du bouton "J'adore" flottant et des petits cœurs volants
               * qui se déclenchent lors du clic avec des coordonnées d'envol aléatoires.
               **/}
              <View style={styles.likeBtnContainer}>
                {flyingHearts.map((heart) => {
                  const translateY = heart.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -160],
                  });

                  const translateX = heart.anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, heart.x, heart.x * 1.5],
                  });

                  const opacity = heart.anim.interpolate({
                    inputRange: [0, 0.75, 1],
                    outputRange: [1, 0.8, 0],
                  });

                  return (
                    <Animated.View
                      key={heart.id}
                      style={[
                        styles.flyingHeart,
                        {
                          transform: [
                            { translateX },
                            { translateY },
                            { scale: heart.scale },
                          ],
                          opacity,
                        },
                      ]}
                    >
                      <Ionicons name="heart" size={24} color="#FF2D55" />
                    </Animated.View>
                  );
                })}

                <Animated.View style={{ transform: [{ scale: likeBtnScale }] }}>
                  <TouchableOpacity
                    style={styles.floatingLikeBtn}
                    onPress={handleLike}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="heart" size={36} color={COLORS.white} />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </Animated.View>
          </View>
        </>
      ) : (
        /* AJOUT : Carte Google/Apple Maps interactive avec profils géolocalisés */
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {/* Repère personnalisé pour l'utilisateur actuel (Point bleu pulsant) */}
            <Marker coordinate={{ latitude: userLat, longitude: userLng }}>
              <View style={styles.myMarkerContainer}>
                <View style={styles.myMarkerPulse} />
                <View style={styles.myMarkerDot} />
              </View>
            </Marker>

            {/* Repères pour les autres profils à proximité */}
            {profiles.map((p) => {
              if (!p.latitude || !p.longitude) return null;
              const pAge = calculateAge(p.birth_date);
              return (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                >
                  <View style={styles.profileMarker}>
                    <Image
                      source={
                        p.avatar_url
                          ? { uri: p.avatar_url }
                          : require('../../assets/default-avatar.png')
                      }
                      style={styles.markerAvatar}
                    />
                  </View>
                  <Callout tooltip onPress={() => handleMarkerPress(p)}>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutName}>
                        {p.full_name}{pAge ? `, ${pAge}` : ''}
                      </Text>
                      <Text style={styles.calloutDistance}>
                        À {p.distance ? formatDistance(p.distance) : '?? km'}
                      </Text>
                      {p.bio ? (
                        <Text style={styles.calloutBio} numberOfLines={2}>
                          {p.bio}
                        </Text>
                      ) : null}
                      <Text style={styles.calloutAction}>👆 Appuyer pour swiper</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        </View>
      )}
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
  // AJOUT : Styles pour le bouton sélecteur Découverte / Carte
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderRadius: 25,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 21,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  // AJOUT : Styles de positionnement des cartes Tinder empilées (deck)
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    paddingBottom: 20,
  },
  cardTop: {
    position: 'absolute',
    zIndex: 10,
    width: '100%',
    alignItems: 'center',
  },
  cardUnderneath: {
    position: 'absolute',
    zIndex: 1,
    width: '100%',
    alignItems: 'center',
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.75,
  },
  // AJOUT : Conteneur pour le bouton flottant J'adore et les cœurs volants
  likeBtnContainer: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    zIndex: 100,
  },
  floatingLikeBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  flyingHeart: {
    position: 'absolute',
    bottom: 22,
    right: 22,
    zIndex: 99,
  },
  // AJOUT : Tampons PASS / SUIVANT
  nextStamp: {
    position: 'absolute',
    top: 40,
    left: 40,
    zIndex: 1000,
    borderWidth: 4,
    borderColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  nextStampText: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  passStamp: {
    position: 'absolute',
    top: 40,
    right: 40,
    zIndex: 1000,
    borderWidth: 4,
    borderColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  passStampText: {
    color: '#FF3B30',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
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
  // AJOUT : Styles pour l'overlay de chargement global translucide
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Fond blanc transparent premium
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingGlass: {
    padding: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  loadingOverlayText: {
    marginTop: 15,
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // AJOUT : Styles de la carte interactive
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  // Repère bleu pulsant utilisateur
  myMarkerContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 2,
  },
  myMarkerPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
    zIndex: 1,
  },
  // Repères ronds photo des autres profils
  profileMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  markerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  // Bulle Callout info
  calloutContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    width: 220,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  calloutName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
  },
  calloutDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  calloutBio: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    lineHeight: 16,
  },
  calloutAction: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;
