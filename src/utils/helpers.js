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
