import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');

const OpeningScreen = ({ onFinish }) => {
  const videoRef = useRef(null);

  const handlePlaybackStatusUpdate = (status) => {
    // Détecte quand la vidéo atteint la fin des 4 secondes
    if (status.didJustFinish) {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../../assets/opening.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    width: width,
    height: height,
  },
});

export default OpeningScreen;