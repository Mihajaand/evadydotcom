/**
 * Configuration Stripe côté client
 * 
 * Les clés sont chargées depuis le fichier .env
 * Voir .env.example pour les variables requises
 */

// Clé publique Stripe (chargée depuis .env)
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// URL de l'Edge Function Supabase pour les PaymentIntents
export const PAYMENT_FUNCTION_URL =
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`;

// ============================================================
// E-VADY — Configuration Stripe (via Checkout Session web)
// ============================================================

export const STRIPE_CONFIG = {
  // URL de base des Edge Functions Supabase
  FUNCTION_URL: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`,

  // IDs des produits Stripe
  PRODUCTS: {
    basic: process.env.EXPO_PUBLIC_STRIPE_PRODUCT_BASIC,
    premium: process.env.EXPO_PUBLIC_STRIPE_PRODUCT_PREMIUM,
    vip: process.env.EXPO_PUBLIC_STRIPE_PRODUCT_VIP,
  },
};
