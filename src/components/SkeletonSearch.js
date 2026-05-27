/**
 * Composant SkeletonSearch - Écran de chargement factice pour la recherche de profils
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonSearch = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Rendu de 4 cartes squelettes
  return (
    <View style={styles.container}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.card}>
          {/* Avatar squelette */}
          <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />
          
          {/* Infos squelettes */}
          <View style={styles.infoContainer}>
            <Animated.View style={[styles.name, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.meta, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.bio, { opacity: pulseAnim }]} />
          </View>

          {/* Chevron squelette */}
          <Animated.View style={[styles.chevron, { opacity: pulseAnim }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
    gap: 6,
  },
  name: {
    width: '55%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  meta: {
    width: '35%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  bio: {
    width: '80%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  chevron: {
    width: 14,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
});

export default SkeletonSearch;
