/**
 * Composant SkeletonCard - Écran de chargement factice (Skeleton) pour les cartes de profils
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { COLORS } from '../utils/constants';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.94;
const CARD_HEIGHT = height * 0.74;

const SkeletonCard = () => {
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

  return (
    <View style={styles.card}>
      {/* Background pulsing placeholder */}
      <Animated.View style={[styles.shimmerBackground, { opacity: pulseAnim }]} />
      
      {/* Skeleton overlay info */}
      <View style={styles.overlay}>
        {/* Placeholder badge */}
        <Animated.View style={[styles.badgePlaceholder, { opacity: pulseAnim }]} />

        {/* Placeholder Name */}
        <Animated.View style={[styles.namePlaceholder, { opacity: pulseAnim }]} />

        {/* Placeholder Distance */}
        <Animated.View style={[styles.distancePlaceholder, { opacity: pulseAnim }]} />

        {/* Placeholder Bio Line 1 */}
        <Animated.View style={[styles.bioPlaceholder1, { opacity: pulseAnim }]} />
        
        {/* Placeholder Bio Line 2 */}
        <Animated.View style={[styles.bioPlaceholder2, { opacity: pulseAnim }]} />
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
    backgroundColor: '#E0E0E0',
    justifyContent: 'flex-end',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  shimmerBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D1D1D1',
  },
  overlay: {
    padding: 20,
    gap: 12,
  },
  badgePlaceholder: {
    width: 80,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#B5B5B5',
  },
  namePlaceholder: {
    width: '60%',
    height: 32,
    borderRadius: 6,
    backgroundColor: '#B5B5B5',
  },
  distancePlaceholder: {
    width: '40%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#B5B5B5',
  },
  bioPlaceholder1: {
    width: '90%',
    height: 14,
    borderRadius: 3,
    backgroundColor: '#B5B5B5',
  },
  bioPlaceholder2: {
    width: '75%',
    height: 14,
    borderRadius: 3,
    backgroundColor: '#B5B5B5',
  },
});

export default SkeletonCard;
