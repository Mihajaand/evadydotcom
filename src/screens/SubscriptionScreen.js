// ============================================================
// E-VADY — Écran Abonnements
// Affiche les 4 plans et redirige vers Stripe Checkout
// Compatible Expo Go (pas de SDK natif requis)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { COLORS } from '../utils/constants';
import { STRIPE_CONFIG } from '../utils/stripe';
import useAuthStore from '../store/authStore';
import { supabase } from '../supabase/client';

// ---- Définition des plans ----
const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0€',
    period: '',
    messages: '20 messages/jour',
    features: ['Voir les profils', 'Swipe basique', '20 messages/jour'],
    color: '#999',
    popular: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '9,99€',
    period: '/mois',
    messages: '100 messages/jour',
    features: ['Tout du Gratuit', '100 messages/jour', 'Voir qui vous a liké'],
    color: COLORS.secondary,
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '19,99€',
    period: '/mois',
    messages: '300 messages/jour',
    features: ['Tout du Basic', '300 messages/jour', 'Boost de profil', 'Super Like'],
    color: COLORS.primary,
    popular: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '39,99€',
    period: '/mois',
    messages: 'Messages illimités',
    features: [
      'Tout du Premium',
      'Messages illimités',
      'Badge VIP',
      'Priorité de visibilité',
      'Support prioritaire',
    ],
    color: '#FFD700',
    popular: false,
  },
];

export default function SubscriptionScreen() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(null); // plan en cours de chargement
  const [currentTier, setCurrentTier] = useState('free');

  // ---- Charger l'abonnement actuel ----
  useEffect(() => {
    refreshSubscription();
  }, [profile]);

  // ---- Gérer l'achat d'un plan ----
  const handleSubscribe = async (plan) => {
    // Si c'est le plan gratuit ou déjà le plan actuel, ne rien faire
    if (plan.id === 'free') {
      Alert.alert('Plan Gratuit', 'Vous êtes déjà sur le plan gratuit.');
      return;
    }

    if (plan.id === currentTier) {
      Alert.alert('Déjà abonné', `Vous êtes déjà sur le plan ${plan.name}.`);
      return;
    }

    setLoading(plan.id);

    try {
      // ---- Appeler l'Edge Function pour créer la Checkout Session ----
      const response = await fetch(
        `${STRIPE_CONFIG.FUNCTION_URL}/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plan: plan.id,
            userId: profile.id,
            email: profile.email || null,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.url) {
        throw new Error('URL de paiement non reçue');
      }

      // ---- Ouvrir la page de paiement Stripe dans le navigateur ----
      const result = await WebBrowser.openBrowserAsync(data.url, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // Quand l'utilisateur revient dans l'app, vérifier l'abonnement
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // Rafraîchir le profil pour voir si le paiement a été traité
        await refreshSubscription();
      }
    } catch (error) {
      console.error('Erreur paiement:', error);
      Alert.alert(
        'Erreur de paiement',
        error.message || 'Une erreur est survenue. Veuillez réessayer.'
      );
    } finally {
      setLoading(null);
    }
  };

  // ---- Rafraîchir l'abonnement depuis Supabase ----
  const refreshSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', profile.id)
        .single();

      if (!error && data) {
        setCurrentTier(data.tier || 'free');
      }
    } catch (e) {
      console.log('Erreur refresh subscription:', e);
    }
  };

  // ---- Rendu d'une carte de plan ----
  const renderPlanCard = (plan) => {
    const isCurrentPlan = currentTier === plan.id;
    const isLoading = loading === plan.id;

    return (
      <View
        key={plan.id}
        style={[
          styles.card,
          plan.popular && styles.popularCard,
          isCurrentPlan && styles.currentCard,
        ]}
      >
        {/* Badge "Populaire" */}
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>⭐ POPULAIRE</Text>
          </View>
        )}

        {/* Badge "Plan actuel" */}
        {isCurrentPlan && (
          <View style={[styles.popularBadge, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.popularBadgeText}>✓ PLAN ACTUEL</Text>
          </View>
        )}

        {/* Nom du plan */}
        <Text style={[styles.planName, { color: plan.color }]}>
          {plan.name}
        </Text>

        {/* Prix */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{plan.price}</Text>
          <Text style={styles.period}>{plan.period}</Text>
        </View>

        {/* Messages */}
        <Text style={styles.messagesText}>{plan.messages}</Text>

        {/* Séparateur */}
        <View style={styles.separator} />

        {/* Fonctionnalités */}
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}

        {/* Bouton d'action */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: isCurrentPlan ? '#CCC' : plan.color },
          ]}
          onPress={() => handleSubscribe(plan)}
          disabled={isCurrentPlan || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              {isCurrentPlan
                ? 'Plan actuel'
                : plan.id === 'free'
                ? 'Plan actuel'
                : `Choisir ${plan.name}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ---- En-tête ---- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Abonnements</Text>
        <Text style={styles.headerSubtitle}>
          Choisissez le plan qui vous convient
        </Text>
      </View>

      {/* ---- Liste des plans ---- */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {PLANS.map(renderPlanCard)}

        {/* ---- Mentions légales ---- */}
        <Text style={styles.legalText}>
          Les abonnements sont renouvelés automatiquement chaque mois.
          Vous pouvez annuler à tout moment depuis votre espace Stripe.
        </Text>
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  popularCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  currentCard: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  period: {
    fontSize: 16,
    color: '#999',
    marginLeft: 2,
  },
  messagesText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureCheck: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
    width: 20,
  },
  featureText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  subscribeButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legalText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 20,
  },
});
