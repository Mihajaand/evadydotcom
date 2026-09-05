/**
 * LeafletMap — version iOS / Android
 *
 * Fichier résolu automatiquement par Metro sur iOS et Android grâce au
 * suffixe ".native.js" (aucun Platform.OS à gérer côté appelant).
 *
 * Remplace react-native-maps (MapView/Marker/Callout) par une WebView
 * embarquant Leaflet.js. C'est ce qui règle le crash Android au clic sur
 * la carte (bug natif connu de react-native-maps avec Callout/Marker
 * custom sur Android).
 *
 * Dépendance requise :
 *   npx expo install react-native-webview
 *   (ou : npm install react-native-webview)
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getLeafletMapHtml } from '../utils/leafletMapHtml';

const LeafletMap = forwardRef(
  ({ myLocation, initialRegion, markers = [], onMarkerPress, primaryColor }, ref) => {
    const webviewRef = useRef(null);
    const isReady = useRef(false);
    const pendingMarkers = useRef(markers);
    const html = useRef(getLeafletMapHtml(initialRegion, { primaryColor })).current;

    // Exécute du JS dans la WebView en avalant les erreurs (ex: appel avant
    // que Leaflet ait fini de charger) pour ne jamais faire planter l'app.
    const runJS = useCallback((script) => {
      webviewRef.current?.injectJavaScript(`(function(){try{${script};}catch(e){}})(); true;`);
    }, []);

    const pushMarkers = useCallback(
      (list) => {
        const json = JSON.stringify(list || []).replace(/</g, '\\u003c');
        runJS(`window.updateMarkers(${json})`);
      },
      [runJS]
    );

    const pushMyLocation = useCallback(
      (loc) => {
        if (!loc) return;
        runJS(`window.setMyLocation(${loc.latitude}, ${loc.longitude})`);
      },
      [runJS]
    );

    useImperativeHandle(
      ref,
      () => ({
        // Même signature que l'ancien mapRef.current.animateToRegion(region, duration)
        animateToRegion: (region, duration = 1000) => {
          if (!region) return;
          runJS(
            `window.flyToRegion(${region.latitude}, ${region.longitude}, ${region.latitudeDelta}, ${region.longitudeDelta}, ${duration})`
          );
        },
      }),
      [runJS]
    );

    useEffect(() => {
      pendingMarkers.current = markers;
      if (isReady.current) {
        pushMarkers(markers);
      }
    }, [markers, pushMarkers]);

    useEffect(() => {
      if (isReady.current) {
        pushMyLocation(myLocation);
      }
    }, [myLocation, pushMyLocation]);

    const handleMessage = useCallback(
      (event) => {
        let data;
        try {
          data = JSON.parse(event.nativeEvent.data);
        } catch (e) {
          return;
        }

        if (data.type === 'MAP_READY') {
          isReady.current = true;
          pushMyLocation(myLocation);
          pushMarkers(pendingMarkers.current);
        } else if (data.type === 'MARKER_PRESS') {
          onMarkerPress?.(data.id);
        }
      },
      [myLocation, onMarkerPress, pushMarkers, pushMyLocation]
    );

    return (
      <View style={styles.flex}>
        <WebView
          ref={webviewRef}
          source={{ html }}
          originWhitelist={['*']}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={styles.flex}
          onError={(syntheticEvent) => {
            console.warn('Erreur WebView Leaflet:', syntheticEvent.nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            console.warn('Erreur HTTP WebView Leaflet:', syntheticEvent.nativeEvent);
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default LeafletMap;