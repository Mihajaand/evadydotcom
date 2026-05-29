import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

const useLocation = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Demander la permission de localisation
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission de localisation refusée');
          setLoading(false);
          return;
        }

        // Vérifier si les services de localisation sont activés au niveau du système
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          // Essayer de récupérer la dernière position connue en guise de fallback rapide
          const lastKnown = await Location.getLastKnownPositionAsync({});
          if (lastKnown) {
            setLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
          } else {
            setErrorMsg('Services de localisation désactivés');
          }
          setLoading(false);
          return;
        }

        let coords = null;

        try {
          // 1. Tenter d'obtenir la position actuelle avec une précision équilibrée
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = currentLocation?.coords;
        } catch (getCurrentError) {
          console.warn('getCurrentPositionAsync a échoué, essai de getLastKnownPositionAsync...', getCurrentError.message);
          // 2. Fallback sur la dernière position connue si getCurrentPosition échoue (très fréquent sur émulateur)
          const lastKnown = await Location.getLastKnownPositionAsync({});
          coords = lastKnown?.coords;
        }

        if (coords) {
          setLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } else {
          setErrorMsg('Impossible de récupérer la position actuelle');
        }
      } catch (error) {
        setErrorMsg('Impossible de récupérer la localisation');
        console.error('Erreur localisation générale:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { location, errorMsg, loading };
};

export default useLocation;
