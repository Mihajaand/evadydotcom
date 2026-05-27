/**
 * Composant SkeletonPhotos - Écran de chargement factice pour la grille de photos de profil
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonPhotos = () => {
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

  // Rendu d'une grille factice de 3 photos
  return (
    <View style={styles.grid}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Animated.View
          key={index}
          style={[styles.photoPlaceholder, { opacity: pulseAnim }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoPlaceholder: {
    width: '31%',
    aspectRatio: 0.75,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
});

export default SkeletonPhotos;
