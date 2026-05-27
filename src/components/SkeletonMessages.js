/**
 * Composant SkeletonMessages - Écran de chargement factice pour la liste des messages
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonMessages = () => {
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

  // Rendu de 6 lignes squelettes
  return (
    <View style={styles.container}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.row}>
          {/* Avatar squelette */}
          <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />
          
          {/* Textes squelettes */}
          <View style={styles.textContainer}>
            <View style={styles.topRow}>
              <Animated.View style={[styles.name, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.time, { opacity: pulseAnim }]} />
            </View>
            <Animated.View style={[styles.message, { opacity: pulseAnim }]} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    width: '40%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  time: {
    width: 40,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  message: {
    width: '75%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
});

export default SkeletonMessages;
