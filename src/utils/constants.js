/**
 * Constantes globales de l'application E-VADY
 */

// Couleurs de la marque
export const COLORS = {
  primary: '#F13E93',    // Rose principal
  secondary: '#5DD3B6',  // Vert menthe
  white: '#FFFFFF',
  black: '#1A1A1A',
  gray: '#9E9E9E',
  lightGray: '#F5F5F5',
  darkGray: '#616161',
  danger: '#FF4444',
  overlay: 'rgba(0,0,0,0.5)',
};

// Limites de messages par abonnement
export const MESSAGE_LIMITS = {
  free: 20,
  basic: 100,
  premium: 300,
  vip: Infinity,
};

// Détails des abonnements
export const SUBSCRIPTION_TIERS = [
  {
    id: 'free',
    name: 'GRATUIT',
    price: '0€',
    priceAmount: 0,
    messagesPerDay: 20,
    features: ['20 messages / jour', 'Profil basique', 'Voir les profils'],
  },
  {
    id: 'basic',
    name: 'BASIC',
    price: '9,99€/mois',
    priceAmount: 999,
    messagesPerDay: 100,
    features: ['100 messages / jour', 'Profil mis en avant', 'Voir qui vous aime'],
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    price: '19,99€/mois',
    priceAmount: 1999,
    messagesPerDay: 300,
    features: ['300 messages / jour', 'Boost de visibilité', 'Filtres avancés', 'Voir qui vous aime'],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '39,99€/mois',
    priceAmount: 3999,
    messagesPerDay: 'Illimité',
    features: ['Messages illimités', 'Priorité maximale', 'Badge VIP', 'Support prioritaire'],
  },
];

// Genres disponibles
export const GENDERS = [
  { label: 'Homme', value: 'MALE' },
  { label: 'Femme', value: 'FEMALE' },
];

// Raisons de signalement
export const REPORT_REASONS = [
  'Comportement inapproprié',
  'Harcèlement',
  'Faux profil',
  'Contenu offensant',
  'Spam',
  'Autre',
];
