// ============================================================
// E-VADY — Écran Abonnements
// Apple IAP on iOS; Stripe Checkout on Android and Web.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { getAvailablePurchases, showManageSubscriptionsIOS, useIAP } from 'expo-iap';

// Imports des modules internes
import { COLORS } from '../utils/constants';
import { STRIPE_CONFIG } from '../utils/stripe';
import useAuthStore from '../store/authStore';
import useSubscriptionStore from '../store/subscriptionStore';
import { APP_STORE_PRODUCTS, getTierForAppStoreProduct } from '../utils/appStoreProducts';

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

const getStoreProductId = (product) => product?.id || product?.productId;

export default function SubscriptionScreen({ navigation }) {
  const { profile } = useAuthStore();
  const {
    subscription,
    fetchSubscription,
    cancelSubscription,
    verifyAppStorePurchase,
    setLocalAppStoreSubscription,
  } = useSubscriptionStore();
  const [loading, setLoading] = useState(null); // ID du plan en cours de traitement
  const [cancelling, setCancelling] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [appStoreError, setAppStoreError] = useState(null);
  const [appStorePurchaseError, setAppStorePurchaseError] = useState(null);
  const [appStoreProductsLoading, setAppStoreProductsLoading] = useState(false);
  const processedTransactions = useRef(new Set());
  const isRestoringRef = useRef(false);

  const handleAppStorePurchaseRef = useRef(null);

  const {
    connected: appStoreConnected,
    subscriptions: appStoreSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      handleAppStorePurchaseRef.current?.(purchase, isRestoringRef.current).catch((error) => {
        console.error('Erreur vérification achat Apple:', error);
        Alert.alert(
          'Vérification de l’achat',
          error.message || 'Impossible de vérifier l’achat auprès de l’App Store.'
        );
      }).finally(() => setLoading(null));
    },
    onPurchaseError: (error) => {
      setLoading(null);
      if (error.code !== 'user-cancelled') {
        console.error('Erreur achat App Store:', error);
        setAppStorePurchaseError({
          code: error.code || 'unknown',
          message: error.message || 'Erreur App Store inconnue.',
          productId: error.productId || null,
        });
        Alert.alert('Erreur App Store', error.message || 'Impossible de réaliser cet achat.');
      }
    },
    onError: (error) => {
      console.error('Erreur expo-iap:', error);
      setAppStoreError(error.message);
    },
  });

  const handleAppStorePurchase = useCallback(async (purchase, isRestore = false, silent = false) => {
    const userId = profile?.id;
    const tier = getTierForAppStoreProduct(purchase.productId);
    if (!userId || !tier || !purchase.transactionId) {
      throw new Error('Transaction App Store incomplète ou compte utilisateur absent.');
    }

    if (processedTransactions.current.has(purchase.transactionId)) return;
    processedTransactions.current.add(purchase.transactionId);

    try {
      setAppStorePurchaseError(null);
      const isLocalStoreKitTest = __DEV__ && purchase.environmentIOS?.toLowerCase() === 'xcode';
      if (!isLocalStoreKitTest) {
        await verifyAppStorePurchase(purchase.transactionId, purchase.productId, isRestore);
      }
      await finishTransaction({ purchase, isConsumable: false });
      if (isLocalStoreKitTest) {
        const expirationDate = purchase.expirationDateIOS
          ? new Date(purchase.expirationDateIOS)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        setLocalAppStoreSubscription(tier, expirationDate.toISOString());
      } else {
        await fetchSubscription(userId);
        await useAuthStore.getState().fetchProfile(userId);
      }
      if (!silent) {
        Toast.show({
          type: 'success',
          text1: isRestore ? 'Achats restaurés' : 'Abonnement activé',
          text2: `Votre abonnement ${PLANS.find((plan) => plan.id === tier)?.name || tier} est actif.`,
          position: 'bottom',
          visibilityTime: 4000,
        });
        navigation.navigate('MainTabs', { screen: 'Accueil' });
      }
    } catch (error) {
      processedTransactions.current.delete(purchase.transactionId);
      throw error;
    }
  }, [profile?.id, verifyAppStorePurchase, setLocalAppStoreSubscription, finishTransaction, fetchSubscription, navigation]);

  handleAppStorePurchaseRef.current = handleAppStorePurchase;

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
  }, [profile?.id]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !appStoreConnected) return;

    let active = true;
    setAppStoreProductsLoading(true);
    fetchProducts({
      skus: Object.values(APP_STORE_PRODUCTS),
      type: 'subs',
    }).catch((error) => {
      console.error('Erreur chargement abonnements App Store:', error);
      if (active) setAppStoreError(error.message);
    }).finally(() => {
      if (active) setAppStoreProductsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [appStoreConnected, fetchProducts]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !appStoreConnected) return;
    const productIds = appStoreSubscriptions.map(getStoreProductId).filter(Boolean);
    console.info('[IAP] StoreKit subscriptions loaded:', productIds.length ? productIds : '(none)');
  }, [appStoreConnected, appStoreSubscriptions]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !appStoreConnected || !profile?.id) return;

    getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })
      .then(async (purchases) => {
        const latestPurchase = purchases
          .filter((purchase) => getTierForAppStoreProduct(purchase.productId))
          .sort((left, right) => right.transactionDate - left.transactionDate)[0];
        if (latestPurchase) {
          await handleAppStorePurchase(latestPurchase, true, true);
        }
      })
      .catch((error) => {
        console.error('Erreur synchronisation des achats Apple:', error);
        setAppStoreError(error.message);
      });
  }, [appStoreConnected, profile?.id, handleAppStorePurchase]);

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

    if (Platform.OS === 'ios' && currentTier !== 'free' && subscription.payment_provider !== 'app_store') {
      Alert.alert(
        'Abonnement déjà actif',
        'Un abonnement existant est déjà associé à ce compte. Gérez d’abord cet abonnement avant d’en acheter un autre.'
      );
      return;
    }

    setAppStorePurchaseError(null);
    setLoading(plan.id);

    try {
      if (Platform.OS === 'ios') {
        if (!profile?.id) throw new Error('Connectez-vous pour acheter un abonnement.');
        if (!appStoreConnected) throw new Error('Connexion à l’App Store indisponible. Réessayez.');

        const productId = APP_STORE_PRODUCTS[plan.id];
        const productIsAvailable = appStoreSubscriptions.some(
          (product) => getStoreProductId(product) === productId
        );
        if (!productIsAvailable) {
          console.warn('[IAP] SKU absent de la liste StoreKit; tentative d’achat directe:', {
            requestedProductId: productId,
            loadedProductIds: appStoreSubscriptions.map(getStoreProductId).filter(Boolean),
          });
        }

        await requestPurchase({
          type: 'subs',
          request: {
            apple: {
              sku: productId,
              appAccountToken: profile.id,
            },
          },
        });
        return;
      }

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
      setLoading(null);
      console.error('Erreur lors du paiement:', error);
      Alert.alert(
        'Erreur de paiement',
        error.message || 'Une erreur est survenue lors de la redirection vers le paiement.'
      );
    } finally {
      if (Platform.OS !== 'ios') setLoading(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (!profile?.id) {
      Alert.alert('Connexion requise', 'Connectez-vous pour restaurer vos achats.');
      return;
    }

    setRestoring(true);
    isRestoringRef.current = true;
    setAppStoreError(null);
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const appStorePurchases = purchases.filter((purchase) =>
        getTierForAppStoreProduct(purchase.productId)
      );

      if (!appStorePurchases.length) {
        Alert.alert('Aucun abonnement', 'Aucun abonnement App Store actif n’a été trouvé.');
        return;
      }

      for (const purchase of appStorePurchases) {
        await handleAppStorePurchase(purchase, true);
      }
    } catch (error) {
      console.error('Erreur restauration achats App Store:', error);
      Alert.alert('Erreur', error.message || 'Impossible de restaurer les achats.');
    } finally {
      isRestoringRef.current = false;
      setRestoring(false);
    }
  };

  // ---- Gérer l'annulation du renouvellement ----
  const handleCancelSubscription = () => {
    if (!subscription?.expires_at) return;

    if (subscription.payment_provider === 'app_store') {
      Alert.alert(
        'Gérer l’abonnement Apple',
        'Apple gère la résiliation et les renouvellements. Vous pouvez modifier ou annuler votre abonnement dans les réglages de votre compte App Store.',
        [
          { text: 'Plus tard', style: 'cancel' },
          {
            text: 'Ouvrir les abonnements',
            onPress: async () => {
              try {
                await showManageSubscriptionsIOS();
              } catch (error) {
                console.error('Erreur ouverture gestion des abonnements Apple:', error);
                try {
                  await Linking.openURL('https://apps.apple.com/account/subscriptions');
                } catch (linkError) {
                  console.error('Erreur ouverture réglages App Store:', linkError);
                  Alert.alert('Erreur', 'Impossible d’ouvrir la gestion des abonnements Apple.');
                }
              }
            },
          },
        ]
      );
      return;
    }

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
          <Text style={styles.price}>
            {Platform.OS === 'ios'
              ? appStoreSubscriptions.find((product) => getStoreProductId(product) === APP_STORE_PRODUCTS[plan.id])?.displayPrice || plan.price
              : plan.price}
          </Text>
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
          disabled={isCurrentPlan || isLoading || (Platform.OS === 'ios' && (!appStoreConnected || appStoreProductsLoading))}
        >
          {isLoading || (Platform.OS === 'ios' && (!appStoreConnected || appStoreProductsLoading)) ? (
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
                  <Text style={styles.cancelButtonText}>
                    {subscription.payment_provider === 'app_store'
                      ? 'Gérer dans l’App Store'
                      : "Annuler l'abonnement"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {Platform.OS === 'ios' && appStoreError && (
          <Text style={styles.legalText}>
            Achats App Store indisponibles : {appStoreError}
          </Text>
        )}

        {Platform.OS === 'ios' && appStorePurchaseError && (
          <View style={styles.iapDiagnostic}>
            <Text style={styles.iapDiagnosticTitle}>Diagnostic App Store à transmettre</Text>
            <Text style={styles.iapDiagnosticText}>Code : {appStorePurchaseError.code}</Text>
            <Text style={styles.iapDiagnosticText}>
              SKU demandé : {appStorePurchaseError.productId || 'inconnu'}
            </Text>
            <Text style={styles.iapDiagnosticText}>
              SKU reçus : {appStoreSubscriptions.map(getStoreProductId).filter(Boolean).join(', ') || '(aucun)'}
            </Text>
            <Text style={styles.iapDiagnosticText}>Détail : {appStorePurchaseError.message}</Text>
          </View>
        )}

        {PLANS.map(renderPlanCard)}

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleRestorePurchases}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#E91E63" />
            ) : (
              <Text style={styles.cancelButtonText}>Restaurer les achats</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.legalText}>
          Les abonnements payants sont renouvelés automatiquement chaque mois.
          Vous pouvez annuler le renouvellement à tout moment depuis cet écran ou les réglages de l’App Store sur iOS.
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
  iapDiagnostic: {
    backgroundColor: '#FFF4F4',
    borderColor: '#E8A0A0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  iapDiagnosticTitle: {
    color: '#8E2323',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  iapDiagnosticText: {
    color: '#6E3333',
    fontSize: 12,
    lineHeight: 18,
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