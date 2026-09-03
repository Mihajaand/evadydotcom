// ============================================================
// E-VADY — Écran Abonnements
// Affiche tous les plans et redirige vers Stripe Checkout
// Compatible Expo Go et Web
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
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';

// Imports des modules internes
import { COLORS } from '../utils/constants';
import { STRIPE_CONFIG } from '../utils/stripe';
import useAuthStore from '../store/authStore';
import useSubscriptionStore from '../store/subscriptionStore';

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

export default function SubscriptionScreen({ navigation }) {
  const { profile } = useAuthStore();
  const { subscription, fetchSubscription, cancelSubscription } = useSubscriptionStore();
  const [loading, setLoading] = useState(null); // ID du plan en cours de traitement
  const [cancelling, setCancelling] = useState(false);

  // Un abonnement est expiré si la date d'expiration est atteinte
  const isExpired = subscription?.expires_at
    ? new Date(subscription.expires_at) < new Date()
    : false;

  // Si le plan est expiré, l'utilisateur repasse virtuellement en 'free'
  const currentTier = isExpired ? 'free' : (subscription?.tier || 'free');

  // ---- Charger l'abonnement actuel ----
  useEffect(() => {
    if (profile?.id) {
      fetchSubscription(profile.id);
    }
  }, [profile]);

  // ---- Gérer la souscription ou le renouvellement ----
  const handleSubscribe = async (plan) => {
    if (plan.id === 'free') {
      Alert.alert('Plan Gratuit', 'Vous êtes actuellement sur le plan gratuit.');
      return;
    }

    // Interdire uniquement si l'utilisateur possède déjà le plan ET qu'il n'est pas expiré
    if (plan.id === currentTier && !isExpired && !subscription?.cancel_at_period_end) {
      Alert.alert('Déjà abonné', `Vous bénéficiez déjà du plan ${plan.name}.`);
      return;
    }

    setLoading(plan.id);

    try {
      // Appeler l'Edge Function Supabase pour générer la session Checkout Stripe
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
        throw new Error('URL de paiement introuvable');
      }

      // 🔴 CORRECTION : Traitement selon la plateforme pour éviter le blocage de Pop-up
      if (Platform.OS === 'web') {
        // Sur Navigateur Web : Redirection directe pour éviter la prévention anti pop-up
        window.location.href = data.url;
        return;
      }

      // Sur Mobile (iOS / Android) : Ouverture de la session WebBrowser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'evady://payment-success'
      );

      // Traitement du retour utilisateur sur mobile
      if (['success', 'cancel', 'dismiss'].includes(result.type)) {
        if (profile?.id) {
          await fetchSubscription(profile.id);
          try {
            await useAuthStore.getState().fetchProfile(profile.id);
          } catch (profileErr) {
            console.error('Erreur rechargement profil:', profileErr);
          }
          
          const updatedSub = useSubscriptionStore.getState().subscription;
          const newTier = updatedSub?.tier || 'free';
          
          if (newTier !== 'free') {
            const activePlan = PLANS.find((p) => p.id === newTier);
            const planName = activePlan ? activePlan.name : newTier.toUpperCase();
            
            Toast.show({
              type: 'success',
              text1: 'Abonnement activé',
              text2: `Votre abonnement ${planName} est désormais actif.`,
              position: 'bottom',
              visibilityTime: 4000,
            });
            
            navigation.navigate('MainTabs', { screen: 'Accueil' });
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
      Alert.alert(
        'Erreur de paiement',
        error.message || 'Une erreur est survenue lors de la redirection vers le paiement.'
      );
    } finally {
      setLoading(null);
    }
  };

  // ---- Gérer l'annulation du renouvellement ----
  const handleCancelSubscription = () => {
    if (!subscription?.expires_at) return;

    const formattedDate = new Date(subscription.expires_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    Alert.alert(
      "Annuler l'abonnement",
      `Êtes-vous sûr de vouloir désactiver le renouvellement automatique ? Vos avantages resteront valides jusqu'au ${formattedDate}.`,
      [
        { text: "Conserver mon abonnement", style: "cancel" },
        {
          text: "Désactiver le renouvellement",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelSubscription(profile.id);
              Alert.alert(
                "Renouvellement désactivé",
                "Votre abonnement prendra fin à la date d'échéance sans être reconduit."
              );
            } catch (error) {
              console.error("Erreur annulation:", error);
              Alert.alert(
                "Erreur",
                error.message || "Impossible de désactiver le renouvellement automatique."
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ---- Rendu d'une carte de plan ----
  const renderPlanCard = (plan) => {
    const isCurrentPlan = currentTier === plan.id && !isExpired;
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
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>⭐ POPULAIRE</Text>
          </View>
        )}

        {isCurrentPlan && (
          <View style={[styles.popularBadge, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.popularBadgeText}>✓ PLAN ACTUEL</Text>
          </View>
        )}

        <Text style={[styles.planName, { color: plan.color }]}>
          {plan.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{plan.price}</Text>
          <Text style={styles.period}>{plan.period}</Text>
        </View>

        <Text style={styles.messagesText}>{plan.messages}</Text>

        <View style={styles.separator} />

        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}

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
                ? 'Plan Gratuit'
                : `Choisir ${plan.name}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Abonnements</Text>
        <Text style={styles.headerSubtitle}>
          Choisissez le plan qui vous convient
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subscription && subscription.tier !== 'free' && (
          <View style={styles.activeSubscriptionCard}>
            <Text style={styles.activeSubscriptionTitle}>Votre abonnement actuel</Text>
            
            <View style={styles.activeSubscriptionRow}>
              <Text style={styles.activeSubscriptionPlanName}>
                E-VADY {PLANS.find((p) => p.id === subscription.tier)?.name || subscription.tier.toUpperCase()}
              </Text>

              <View style={[
                styles.statusBadge, 
                { backgroundColor: (subscription.cancel_at_period_end || isExpired) ? '#FFEBEB' : '#E8F5E9' }
              ]}>
                <Text style={[
                  styles.statusBadgeText, 
                  { color: (subscription.cancel_at_period_end || isExpired) ? '#D32F2F' : '#2E7D32' }
                ]}>
                  {isExpired ? 'Expiré' : subscription.cancel_at_period_end ? 'Résilié' : 'Actif'}
                </Text>
              </View>
            </View>

            <Text style={styles.activeSubscriptionDetails}>
              {isExpired
                ? "Votre abonnement est arrivé à échéance. Vous pouvez souscrire à une nouvelle offre ci-dessous."
                : subscription.cancel_at_period_end
                ? `Votre abonnement prendra fin le ${new Date(subscription.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Le renouvellement automatique est désactivé.`
                : `Votre abonnement sera automatiquement renouvelé le ${new Date(subscription.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
              }
            </Text>

            {!subscription.cancel_at_period_end && !isExpired && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#E91E63" />
                ) : (
                  <Text style={styles.cancelButtonText}>Annuler l'abonnement</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {PLANS.map(renderPlanCard)}

        <Text style={styles.legalText}>
          Les abonnements payants sont renouvelés automatiquement chaque mois.
          Vous pouvez annuler le renouvellement à tout moment depuis cet écran.
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
  activeSubscriptionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeSubscriptionTitle: {
    fontSize: 14,
    color: '#777',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  activeSubscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeSubscriptionPlanName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeSubscriptionDetails: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#E91E63',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#E91E63',
    fontSize: 14,
    fontWeight: 'bold',
  },
});