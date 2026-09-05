/**
 * LeafletMap — version Web
 *
 * Fichier résolu automatiquement par le bundler web (Expo web / react-native-web)
 * grâce au suffixe ".web.js" (aucun Platform.OS à gérer côté appelant).
 *
 * Utilise EXACTEMENT le même HTML Leaflet que la version native
 * (utils/leafletMapHtml.js), chargé dans un <iframe>, pour garantir un rendu
 * et un comportement identiques sur les 3 plateformes.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { getLeafletMapHtml } from '../utils/leafletMapHtml';

const LeafletMap = forwardRef(
  ({ myLocation, initialRegion, markers = [], onMarkerPress, primaryColor }, ref) => {
    const iframeRef = useRef(null);
    const isReady = useRef(false);
    const pendingMarkers = useRef(markers);
    const html = useRef(getLeafletMapHtml(initialRegion, { primaryColor })).current;

    const postToIframe = useCallback((message) => {
      iframeRef.current?.contentWindow?.postMessage(message, '*');
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        // Même signature que l'ancien mapRef.current.animateToRegion(region, duration)
        animateToRegion: (region, duration = 1000) => {
          if (!region) return;
          postToIframe({
            type: 'FLY_TO',
            lat: region.latitude,
            lng: region.longitude,
            latDelta: region.latitudeDelta,
            lngDelta: region.longitudeDelta,
            duration,
          });
        },
      }),
      [postToIframe]
    );

    useEffect(() => {
      pendingMarkers.current = markers;
      if (isReady.current) {
        postToIframe({ type: 'UPDATE_MARKERS', markers });
      }
    }, [markers, postToIframe]);

    useEffect(() => {
      if (isReady.current && myLocation) {
        postToIframe({ type: 'SET_MY_LOCATION', lat: myLocation.latitude, lng: myLocation.longitude });
      }
    }, [myLocation, postToIframe]);

    useEffect(() => {
      const handleMessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'MAP_READY') {
          isReady.current = true;
          if (myLocation) {
            postToIframe({ type: 'SET_MY_LOCATION', lat: myLocation.latitude, lng: myLocation.longitude });
          }
          postToIframe({ type: 'UPDATE_MARKERS', markers: pendingMarkers.current });
        } else if (data.type === 'MARKER_PRESS') {
          onMarkerPress?.(data.id);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myLocation, onMarkerPress, postToIframe]);

    return (
      <View style={styles.flex}>
        <iframe
          ref={iframeRef}
          title="leaflet-map"
          srcDoc={html}
          style={webIframeStyle}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

// Style DOM natif (pas StyleSheet.create) car <iframe> est un vrai élément HTML.
const webIframeStyle = {
  border: 0,
  width: '100%',
  height: '100%',
};

export default LeafletMap;