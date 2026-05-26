/**
 * Utilitaires de calcul de distance - Formule de Haversine
 * Calcule la distance en km entre deux points GPS
 */

/**
 * Convertit les degrés en radians
 * @param {number} deg - Angle en degrés
 * @returns {number} Angle en radians
 */
const toRadians = (deg) => (deg * Math.PI) / 180;

/**
 * Calcule la distance entre deux coordonnées GPS en utilisant la formule de Haversine
 * @param {number} lat1 - Latitude du point 1
 * @param {number} lon1 - Longitude du point 1
 * @param {number} lat2 - Latitude du point 2
 * @param {number} lon2 - Longitude du point 2
 * @returns {number} Distance en kilomètres, arrondie à 1 décimale
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Arrondi à 1 décimale
};

/**
 * Formate la distance pour l'affichage
 * @param {number} km - Distance en kilomètres
 * @returns {string} Distance formatée (ex: "2.5 km" ou "800 m")
 */
export const formatDistance = (km) => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km} km`;
};

/**
 * Calcule l'âge à partir de la date de naissance
 * @param {string} birthdate - Date de naissance (format ISO)
 * @returns {number} Âge en années
 */
export const calculateAge = (birthdate) => {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Détermine le pays d'un profil à partir de ses coordonnées GPS (latitude/longitude)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Nom du pays ('France', 'La Réunion', 'Madagascar', 'Seychelles', 'Mayotte', ou 'Autre')
 */
export const getCountryFromCoords = (lat, lng) => {
  if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) {
    return 'Autre';
  }

  // Mayotte (Latitude env. -12.8, Longitude env. 45.1)
  if (lat >= -13.2 && lat <= -12.5 && lng >= 44.8 && lng <= 45.4) {
    return 'Mayotte';
  }

  // La Réunion (Latitude env. -21.1, Longitude env. 55.5)
  if (lat >= -21.6 && lat <= -20.7 && lng >= 55.1 && lng <= 56.0) {
    return 'La Réunion';
  }

  // Seychelles (Latitude env. -4.6, Longitude env. 55.5)
  if (lat >= -5.5 && lat <= -3.5 && lng >= 55.0 && lng <= 56.5) {
    return 'Seychelles';
  }

  // Madagascar (Latitude env. -18.7, Longitude env. 46.8)
  if (lat >= -26.0 && lat <= -11.5 && lng >= 43.0 && lng <= 51.0) {
    return 'Madagascar';
  }

  // France Métropolitaine (Latitude env. 46.2, Longitude env. 2.2)
  if (lat >= 41.0 && lat <= 51.5 && lng >= -5.5 && lng <= 10.0) {
    return 'France';
  }

  return 'Autre';
};

