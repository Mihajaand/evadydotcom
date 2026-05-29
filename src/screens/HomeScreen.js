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
  ScrollView, // MODIFICATION : Ajout pour les barres de défilement de filtres
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout } from 'react-native-maps'; // MODIFICATION : Intégration de la carte interactive
import { COLORS } from '../utils/constants';
import { haversineDistance, calculateAge, formatDistance, getCountryFromCoords } from '../utils/helpers'; // MODIFICATION : Import des helpers d'âge et formatage
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import ProfileCard from '../components/ProfileCard';
import SkeletonCard from '../components/SkeletonCard';
import useLocation from '../hooks/useLocation'; // MODIFICATION : Import du hook GPS

const { width, height } = Dimensions.get('window');

const HomeScreen = () => {
  const { user, profile } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // MODIFICATION : 'card' (glissé Tinder) ou 'map' (carte géographique)

  // ÉTATS DE FILTRAGE : Distance et Pays
  const [selectedDistanceRange, setSelectedDistanceRange] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [activeFilterType, setActiveFilterType] = useState('distance'); // 'distance' ou 'country'

  // Filtrage des profils selon la distance et le pays
  const filteredProfiles = profiles.filter((p) => {
    // 1. Filtre par tranche de distance
    let matchesDistance = true;
    if (selectedDistanceRange !== 'all') {
      const dist = p.distance;
      if (selectedDistanceRange === '0-400') {
        matchesDistance = dist >= 0 && dist <= 400;
      } else if (selectedDistanceRange === '401-1000') {
        matchesDistance = dist > 400 && dist <= 1000;
      } else if (selectedDistanceRange === '1001-3000') {
        matchesDistance = dist > 1000 && dist <= 3000;
      } else if (selectedDistanceRange === '3001-5000') {
        matchesDistance = dist > 3000 && dist <= 5000;
      } else if (selectedDistanceRange === '5000+') {
        matchesDistance = dist > 5000;
      }
    }

    // 2. Filtre par pays
    let matchesCountry = true;
    if (selectedCountry !== 'all') {
      matchesCountry = p.country === selectedCountry;
    }

    return matchesDistance && matchesCountry;
  });

  // Clamping de currentIndex si la liste filtrée change de taille et devient plus petite
  useEffect(() => {
    if (filteredProfiles.length > 0 && currentIndex >= filteredProfiles.length) {
      setCurrentIndex(filteredProfiles.length - 1);
    } else if (filteredProfiles.length === 0 && currentIndex !== 0) {
      setCurrentIndex(0);
    }
  }, [filteredProfiles.length, currentIndex]);

  // Réinitialiser l'index courant à 0 lorsque les filtres changent pour éviter les erreurs hors-limites
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedDistanceRange, selectedCountry]);


  /**
   * @name currentProfile
   * @description Jdoc: Candidat de profil recommandé actif à l'index courant parmi les profils filtrés.
   **/
  const currentProfile = filteredProfiles[currentIndex];

  // AJOUT : États et Refs pour la micro-animation des petits cœurs qui s'envolent
  const [flyingHearts, setFlyingHearts] = useState([]);
  const likeBtnScale = useRef(new Animated.Value(1)).current;
  const floatingAnim = useRef(new Animated.Value(0)).current; // MODIFICATION : Animation de flottaison
  const isTransitioning = useRef(false); // MODIFICATION : Blocage durant la transition pour éviter les sauts
  const mapRef = useRef(null); // AJOUT : Ref de la carte géographique interactive

  // MODIFICATION : Effet de flottaison continue et douce pour le bouton J'adore
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: -8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatingAnim]);

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

  // MODIFICATION : Références pour les coordonnées afin de ne pas recréer fetchProfiles lors de variations GPS mineures
  const userLatRef = useRef(userLat);
  const userLngRef = useRef(userLng);

  useEffect(() => {
    userLatRef.current = userLat;
    userLngRef.current = userLng;
  }, [userLat, userLng]);

  // MODIFICATION : Coordonnées de déplacement XY pour le glissé tactile
  const pan = useRef(new Animated.ValueXY()).current;
  const handlePassSwipeRef = useRef();
  const handleLikeSwipeRef = useRef();

  useEffect(() => {
    handlePassSwipeRef.current = handlePassSwipe;
    handleLikeSwipeRef.current = handleLikeSwipe;
  });

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
  const fetchProfiles = useCallback(async (isSilent = false) => {
    if (!profile) return;

    if (!isSilent) {
      setLoading(true);
    }
    try {
      // Genre opposé
      const oppositeGender = profile.gender === 'MALE' ? 'FEMALE' : 'MALE';

      // Récupérer les profils déjà likés pour les exclure définitivement
      const { data: likedData } = await supabase
        .from('likes')
        .select('liked_id')
        .eq('liker_id', user.id);
      const likedIds = (likedData || []).map((l) => l.liked_id);

      // Récupérer les profils passés récemment (moins de 2 minutes) pour les exclure temporairement
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: passedData } = await supabase
        .from('passes')
        .select('passed_id')
        .eq('passer_id', user.id)
        .gte('created_at', twoMinutesAgo);
      const passedIds = (passedData || []).map((p) => p.passed_id);

      // Récupérer les profils du genre opposé (exclure ceux déjà likés et passés récemment)
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('gender', oppositeGender)
        .neq('id', user.id);

      const excludedIds = Array.from(new Set([...likedIds, ...passedIds]));
      if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // Récupérer les abonnements de ces profils pour l'affichage du badge
      const profileIds = (data || []).map((p) => p.id);
      const subsMap = {};
      if (profileIds.length > 0) {
        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('user_id, tier')
          .in('user_id', profileIds);
        
        (subsData || []).forEach((sub) => {
          subsMap[sub.user_id] = sub.tier;
        });
      }

      // MODIFICATION : Calculer la distance et le pays relatifs à la position GPS réelle (via refs stables)
      const profilesWithDistance = (data || []).map((p) => {
        const distance = haversineDistance(
          userLatRef.current,
          userLngRef.current,
          p.latitude,
          p.longitude
        );
        const country = getCountryFromCoords(p.latitude, p.longitude);
        return {
          ...p,
          distance,
          country,
          subscriptionTier: subsMap[p.id] || 'free',
        };
      });

      // MODIFICATION : Mélange aléatoire (Fisher-Yates) pour changer l'ordre d'affichage des profils
      const shuffledProfiles = [...profilesWithDistance];
      for (let i = shuffledProfiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledProfiles[i], shuffledProfiles[j]] = [shuffledProfiles[j], shuffledProfiles[i]];
      }

      setProfiles(shuffledProfiles);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Erreur chargement profils:', error);
      Alert.alert('Erreur', 'Impossible de charger les profils');
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [profile, user]);

  useEffect(() => {
    if (viewMode === 'card') {
      fetchProfiles();
    }
  }, [viewMode, fetchProfiles]);


  // Rafraîchissement automatique des profils toutes les minutes si la liste est vide (pour réafficher les profils après le délai de 2 min / 10 min)
  useEffect(() => {
    let interval;
    const isListEmpty = filteredProfiles.length <= 0;
    if (isListEmpty && !loading) {
      interval = setInterval(() => {
        fetchProfiles(true); // Requête silencieuse en arrière-plan
      }, 60000); // Réessaye toutes les 60 secondes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [filteredProfiles.length, loading, fetchProfiles]);

    // Centrage et zoom automatique de la carte géographique lors du filtrage ou chargement des profils
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current) return;

    let targetLat = userLat;
    let targetLng = userLng;
    let latDelta = 0.08;
    let lngDelta = 0.04;

    if (activeFilterType === 'country' && selectedCountry !== 'all') {
      // Coordonnées de centrage par pays/territoire
      if (selectedCountry === 'France') {
        targetLat = 46.2276;
        targetLng = 2.2137;
        latDelta = 8.0;
        lngDelta = 8.0;
      } else if (selectedCountry === 'La Réunion') {
        targetLat = -21.1151;
        targetLng = 55.5364;
        latDelta = 0.5;
        lngDelta = 0.5;
      } else if (selectedCountry === 'Madagascar') {
        targetLat = -18.7669;
        targetLng = 46.8691;
        latDelta = 9.0;
        lngDelta = 9.0;
      } else if (selectedCountry === 'Seychelles') {
        targetLat = -4.6796;
        targetLng = 55.4920;
        latDelta = 0.6;
        lngDelta = 0.6;
      } else if (selectedCountry === 'Mayotte') {
        targetLat = -12.8275;
        targetLng = 45.1662;
        latDelta = 0.3;
        lngDelta = 0.3;
      }
    } else {
      // Par distance : recentre sur la position de l'utilisateur
      targetLat = userLat;
      targetLng = userLng;

      // Ajuster le niveau de zoom selon la tranche de distance sélectionnée pour un affichage optimal
      if (selectedDistanceRange === '0-400') {
        latDelta = 4.5;
        lngDelta = 4.5;
      } else if (selectedDistanceRange === '401-1000') {
        latDelta = 10.0;
        lngDelta = 10.0;
      } else if (selectedDistanceRange === '1001-3000') {
        latDelta = 25.0;
        lngDelta = 25.0;
      } else if (selectedDistanceRange === '3001-5000') {
        latDelta = 40.0;
        lngDelta = 40.0;
      } else if (selectedDistanceRange === '5000+') {
        latDelta = 80.0;
        lngDelta = 80.0;
      } else {
        // 'all' s'il n'y a pas d'autres profils : zoom par défaut
        latDelta = 0.08;
        lngDelta = 0.04;
      }
    }

    mapRef.current.animateToRegion({
      latitude: targetLat,
      longitude: targetLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    }, 1000); // 1 seconde de transition fluide premium !
  }, [
    selectedCountry,
    selectedDistanceRange,
    activeFilterType,
    viewMode,
    userLat,
    userLng,
    filteredProfiles,
  ]);

  // MODIFICATION : Interpollation de la rotation minimale style galerie photo
  const rotate = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-1deg', '0deg', '1deg'],
    extrapolate: 'clamp',
  });

  // MODIFICATION : Interpolation de la carte du dessous pour une transition de rapprochement premium
  const underneathScale = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: [1, 0.98, 1],
    extrapolate: 'clamp',
  });

  const underneathTranslateY = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: [0, 0, 0],
    extrapolate: 'clamp',
  });

  const underneathOpacity = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: [1, 0.85, 1],
    extrapolate: 'clamp',
  });

  const animatedUnderneathStyle = {
    transform: [
      { scale: underneathScale },
      { translateY: underneathTranslateY },
    ],
    opacity: underneathOpacity,
  };

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
      { rotate: rotate },
    ],
  };

  // MODIFICATION : Traitement de l'action de Like après swipe avec transition
  const handleLikeSwipe = async () => {
    const currentProfile = filteredProfiles[currentIndex];
    if (!currentProfile) return;

    isTransitioning.current = true;
    // Transition fluide : on attend un court instant avant de réinitialiser la position et exclure le profil de l'état
    setTimeout(() => {
      pan.setValue({ x: 0, y: 0 });
      setProfiles((prev) => prev.filter((p) => p.id !== currentProfile.id));
      isTransitioning.current = false;
    }, 250);

    try {
      // Enregistrer le like
      const { error: likeError } = await supabase.from('likes').insert({
        liker_id: user.id,
        liked_id: currentProfile.id,
      });

      if (likeError) {
        console.error('Erreur enregistrement like (Supabase RLS/DB):', likeError);
      }

      // Vérifier le match mutuel
      const { data: mutualLike, error: mutualError } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_id', currentProfile.id)
        .eq('liked_id', user.id)
        .single();

      if (mutualError && !mutualError.message?.includes('JSON object')) {
        console.error('Erreur verification match (Supabase):', mutualError);
      }

      if (mutualLike) {
        // Envoi automatique d'un message de bienvenue lors du match (expéditeur : user.id, destinataire : currentProfile.id)
        try {
          const { error: welcomeMsgError } = await supabase.from('messages').insert({
            sender_id: user.id,
            receiver_id: currentProfile.id,
            content: `Coucou ! Nous avons matché ! 😊 Comment vas-tu ?`,
            is_read: false,
          });
          if (welcomeMsgError) {
            console.error("Erreur d'envoi du message de match automatique (Supabase):", welcomeMsgError);
          }
        } catch (msgErr) {
          console.error("Erreur d'envoi du message de match automatique (catch):", msgErr);
        }

        Alert.alert('💕 C\'est un Match !', `Vous et ${currentProfile.full_name} vous aimez mutuellement ! Un message automatique vous a été envoyé.`);
      }
    } catch (error) {
      console.error('Erreur globale like (catch):', error);
    }
  };

  // MODIFICATION : Traitement de l'action de Pass après swipe avec transition
  const handlePassSwipe = async () => {
    const currentProfile = filteredProfiles[currentIndex];
    
    isTransitioning.current = true;
    // Transition fluide : on attend un court instant avant de réinitialiser la position et exclure le profil de l'état
    setTimeout(() => {
      pan.setValue({ x: 0, y: 0 });
      if (currentProfile) {
        setProfiles((prev) => prev.filter((p) => p.id !== currentProfile.id));
      }
      isTransitioning.current = false;
    }, 250);

    if (currentProfile && user?.id) {
      try {
        const { error: passError } = await supabase.from('passes').insert({
          passer_id: user.id,
          passed_id: currentProfile.id,
        });
        if (passError) {
          console.error('Erreur enregistrement pass (Supabase RLS/DB):', passError);
        }
      } catch (error) {
        console.error('Erreur enregistrement pass (catch):', error);
      }
    }

  };

  // MODIFICATION : Déclencheurs d'animation pour les clics boutons du bas (avec useNativeDriver: true pour la fluidité)
  const triggerLike = () => {
    Animated.timing(pan, {
      toValue: { x: width + 100, y: 0 },
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      handleLikeSwipeRef.current?.();
    });
  };

  const triggerPass = () => {
    Animated.timing(pan, {
      toValue: { x: -width - 100, y: 0 },
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      handlePassSwipeRef.current?.();
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
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Intercepter UNIQUEMENT si le geste est principalement horizontal (swipe gauche/droite)
        // Si le geste est vertical (l'utilisateur scrolle la page), on renvoie false pour laisser le ScrollView défiler !
        const isHorizontalGesture = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return !isTransitioning.current && isHorizontalGesture && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isTransitioning.current) {
          pan.x.setValue(gestureState.dx);
          pan.y.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (isTransitioning.current) return;
        
        // Vitesse du glissé ou distance seuil
        const isSwiped = Math.abs(gestureState.dx) > 120 || Math.abs(gestureState.vx) > 0.5;
        if (isSwiped && gestureState.dx > 0) {
          // Glissement vers la droite
          isTransitioning.current = true;
          Animated.timing(pan, {
            toValue: { x: width + 100, y: gestureState.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            handlePassSwipeRef.current?.();
          });
        } else if (isSwiped && gestureState.dx < 0) {
          // Glissement vers la gauche
          isTransitioning.current = true;
          Animated.timing(pan, {
            toValue: { x: -width - 100, y: gestureState.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            handlePassSwipeRef.current?.();
          });
        } else {
          // Retour au centre s'il n'y a pas assez de glissement (ressort plus doux)
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 40,
            useNativeDriver: true,
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
   * @description Jdoc: Rendu de l'écran de chargement avec un Skeleton Card moderne et premium.
   **/
  if (isDataLoading) {
    return (
      <View style={styles.container}>
        {/* En-tête de chargement */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Découvrir</Text>
          <Text style={styles.headerCount}>...</Text>
        </View>

        {/* Sélecteur de mode de vue factice */}
        <View style={styles.toggleContainer}>
          <View style={[styles.toggleBtn, styles.toggleActive, { backgroundColor: '#E0E0E0' }]}>
            <Text style={[styles.toggleText, { color: '#A0A0A0' }]}>Découverte</Text>
          </View>
          <View style={styles.toggleBtn}>
            <Text style={styles.toggleText}>Carte</Text>
          </View>
        </View>

        {/* Carte squelette animée */}
        <View style={styles.cardContainer}>
          <SkeletonCard />
        </View>
      </View>
    );
  }

  const distanceRanges = [
    { label: 'Toutes distances', value: 'all' },
    { label: '0 - 400 km', value: '0-400' },
    { label: '401 - 1000 km', value: '401-1000' },
    { label: '1001 - 3000 km', value: '1001-3000' },
    { label: '3001 - 5000 km', value: '3001-5000' },
    { label: '5000 km+', value: '5000+' },
  ];

  const countries = [
    { label: 'Tous pays', value: 'all' },
    { label: 'France 🇫🇷', value: 'France' },
    { label: 'La Réunion 🇷🇪', value: 'La Réunion' },
    { label: 'Madagascar 🇲🇬', value: 'Madagascar' },
    { label: 'Seychelles 🇸🇨', value: 'Seychelles' },
    { label: 'Mayotte 🇾🇹', value: 'Mayotte' },
  ];

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <Text style={styles.headerCount}>
          {filteredProfiles.length - currentIndex > 0 ? filteredProfiles.length - currentIndex : 0} profil{filteredProfiles.length - currentIndex > 1 ? 's' : ''}
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

      {/* BARRES DE FILTRAGE DES PROFILS (visibles uniquement sur la Carte) */}
      {viewMode === 'map' && (
        <View style={styles.filtersContainer}>
          {/* Commutateur de type de filtre : par Distance ou par Pays */}
          <TouchableOpacity
            style={styles.filterTypeSwitcher}
            onPress={() => {
              if (activeFilterType === 'distance') {
                setActiveFilterType('country');
                setSelectedDistanceRange('all');
              } else {
                setActiveFilterType('distance');
                setSelectedCountry('all');
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.filterTypeLabelContainer}>
              <Ionicons
                name={activeFilterType === 'distance' ? 'pin-outline' : 'globe-outline'}
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.filterTypeLabel}>
                Option du filtre : <Text style={styles.filterTypeBold}>{activeFilterType === 'distance' ? 'Distance' : 'Pays'}</Text>
              </Text>
            </View>
            <View style={styles.filterTypeIconContainer}>
              <Ionicons name="swap-vertical-outline" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          {activeFilterType === 'distance' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {distanceRanges.map((range) => (
                <TouchableOpacity
                  key={range.value}
                  style={[
                    styles.filterChip,
                    selectedDistanceRange === range.value && styles.filterChipActive
                  ]}
                  onPress={() => {
                    setSelectedDistanceRange(range.value);
                    if (range.value !== 'all') {
                      setSelectedCountry('all');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedDistanceRange === range.value && styles.filterChipTextActive
                    ]}
                  >
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {countries.map((country) => (
                <TouchableOpacity
                  key={country.value}
                  style={[
                    styles.filterChip,
                    selectedCountry === country.value && styles.filterChipActive
                  ]}
                  onPress={() => {
                    setSelectedCountry(country.value);
                    if (country.value !== 'all') {
                      setSelectedDistanceRange('all');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedCountry === country.value && styles.filterChipTextActive
                    ]}
                  >
                    {country.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {viewMode === 'card' ? (
        <ScrollView
          style={styles.discoveryScroll}
          contentContainerStyle={styles.discoveryScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!currentProfile ? (
            <View style={styles.centerContainer}>
              <Ionicons name="heart-dislike-outline" size={80} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>Plus de profils</Text>
              <Text style={styles.emptyText}>Essayez de modifier vos filtres ou revenez plus tard.</Text>
            </View>
          ) : (
            <View style={styles.cardContainer}>
              {/* AJOUT : Carte du dessous (prochain profil en 3D deck) animée pour une transition premium */}
              {currentIndex + 1 < filteredProfiles.length && (
                <Animated.View 
                  key={filteredProfiles[currentIndex + 1].id}
                  style={[styles.cardUnderneath, animatedUnderneathStyle]}
                >
                  <ProfileCard
                    profile={filteredProfiles[currentIndex + 1]}
                    distance={filteredProfiles[currentIndex + 1].distance}
                  />
                </Animated.View>
              )}

              {/* Carte principale (au dessus) avec gestionnaires PanResponder */}
              <Animated.View
                key={currentProfile.id}
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

                  <Animated.View style={{ transform: [{ scale: likeBtnScale }, { translateY: floatingAnim }] }}>
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
          )}

          {/* Section Qui Sommes-Nous */}
          <View style={styles.aboutUsContainer}>
            <View style={styles.aboutUsHeader}>
              <View style={styles.aboutUsIconContainer}>
                <Ionicons name="code-working" size={24} color={COLORS.white} />
              </View>
              <Text style={styles.aboutUsTitle}>Qui sommes-nous ?</Text>
            </View>
            <View style={styles.aboutUsCard}>
              <Text style={styles.aboutUsText}>
                Nous sommes une équipe passionnée de développeurs créatifs basés à <Text style={{ color: COLORS.primary, fontWeight: '800' }}>Madagascar 🇲🇬</Text>.
              </Text>
              <Text style={styles.aboutUsTextSecondary}>
                Avec <Text style={{ fontWeight: '700', color: COLORS.black }}>E-VADY</Text>, notre ambition est de créer des ponts magiques et sécurisés pour connecter les cœurs. Chaque ligne de code est pensée, testée et peaufinée localement avec amour pour vous offrir l'expérience de rencontre la plus premium et moderne possible.
              </Text>
              <View style={styles.aboutUsFooter}>
                <Ionicons name="heart" size={16} color={COLORS.primary} />
                <Text style={styles.aboutUsFooterText}>Fait avec passion depuis Mada</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* AJOUT : Carte Google/Apple Maps interactive avec profils géolocalisés */
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
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
            {filteredProfiles.map((p) => {
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
    height: height * 0.77,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    marginVertical: 10,
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
  },
  // AJOUT : Conteneur pour le bouton flottant J'adore et les cœurs volants
  likeBtnContainer: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    zIndex: 100,
  },
  floatingLikeBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FF2D55', // Rose/Rouge premium vibrant
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
    elevation: 12,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
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
    marginTop: 8,
    textAlign: 'center',
  },
  // AJOUT : Styles pour les filtres de distance et pays
  filtersContainer: {
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  countryFilterScroll: {
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  // AJOUT : Commutateur de filtre (Distance vs Pays)
  filterTypeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterTypeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTypeLabel: {
    fontSize: 14,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  filterTypeBold: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  filterTypeIconContainer: {
    backgroundColor: COLORS.white,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  discoveryScroll: {
    flex: 1,
  },
  discoveryScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  aboutUsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  aboutUsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  aboutUsIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  aboutUsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
  },
  aboutUsCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  aboutUsText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 8,
  },
  aboutUsTextSecondary: {
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.darkGray,
    marginBottom: 16,
  },
  aboutUsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 12,
  },
  aboutUsFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray,
  },
});

export default HomeScreen;
