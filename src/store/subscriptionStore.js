/**
 * Store d'abonnement Zustand
 * Gère les plans, les paiements Stripe, et l'état de l'abonnement
 */
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { getEdgeFunctionErrorMessage } from '../utils/edgeFunctionError';

const useSubscriptionStore = create((set, get) => ({
  // État
  subscription: null,   // { tier, expires_at, stripe_sub_id, stripe_subscription_id, cancel_at_period_end }
  loading: false,

  /**
   * Récupère l'abonnement actuel de l'utilisateur
   */
  fetchSubscription: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Vérifier si l'abonnement est expiré
      if (
        data &&
        data.expires_at &&
        new Date(data.expires_at) < new Date() &&
        (data.payment_provider === 'app_store' || data.cancel_at_period_end)
      ) {
        const expiredAppleSubscription = data.payment_provider === 'app_store';
        const { data: updated, error: updateError } = await supabase
            .from('subscriptions')
            .update(expiredAppleSubscription
              ? { tier: 'free', cancel_at_period_end: false }
              : {
                  tier: 'free',
                  stripe_sub_id: null,
                  stripe_subscription_id: null,
                  payment_provider: null,
                  expires_at: null,
                  cancel_at_period_end: false,
                })
            .eq('user_id', userId)
            .select()
            .single();
        if (updateError) throw updateError;
        set({ subscription: updated || { tier: 'free' }, loading: false });
      } else {
        set({ subscription: data || { tier: 'free' }, loading: false });
      }
    } catch (error) {
      console.error('Erreur fetchSubscription:', error);
      set({ subscription: { tier: 'free' }, loading: false });
    }
  },

  /**
   * Vérifie une transaction Apple côté serveur avant d'activer le plan.
   */
  verifyAppStorePurchase: async (transactionId, productId, isRestore = false) => {
    const { data, error } = await supabase.functions.invoke(
      'verify-app-store-purchase',
      {
        body: { transactionId, productId, isRestore },
      }
    );

    if (error) {
      throw new Error(await getEdgeFunctionErrorMessage(
        error,
        'Impossible de vérifier l’achat auprès de l’App Store.'
      ));
    }
    if (!data?.active || !data?.subscription) {
      throw new Error(data?.error || 'Aucun abonnement Apple actif trouvé.');
    }

    set({ subscription: data.subscription });
    return data.subscription;
  },

  checkAppStorePurchaseAccount: async (transactionId, productId) => {
    const { data, error } = await supabase.functions.invoke(
      'verify-app-store-purchase',
      {
        body: { transactionId, productId, isRestore: true, preflightOnly: true },
      }
    );

    if (error) {
      throw new Error(await getEdgeFunctionErrorMessage(
        error,
        'Impossible de vérifier le compte associé à cet abonnement Apple.'
      ));
    }
    if (!data?.canPurchase) {
      throw new Error(data?.error || 'Cet abonnement Apple est associé à un autre compte E-VADY.');
    }
  },

  recordStoreKitTestPurchase: async (userId, purchase, tier) => {
    const { error } = await supabase
      .from('app_store_transactions')
      .upsert({
        user_id: userId,
        transaction_id: purchase.transactionId,
        product_id: purchase.productId,
        tier,
        environment: 'Xcode',
        verification_status: 'simulated',
        status: 'simulated',
        event_type: 'XCODE_SIMULATION',
        original_transaction_id: purchase.originalTransactionIdentifierIOS || null,
        transaction_date: purchase.transactionDate
          ? new Date(purchase.transactionDate).toISOString()
          : null,
        expires_at: purchase.expirationDateIOS
          ? new Date(purchase.expirationDateIOS).toISOString()
          : null,
      }, {
        onConflict: 'environment,transaction_id',
        ignoreDuplicates: true,
      });

    if (error) throw error;
  },

  setLocalAppStoreSubscription: (tier, expiresAt) => {
    set({
      subscription: {
        tier,
        expires_at: expiresAt,
        payment_provider: 'app_store',
        cancel_at_period_end: false,
        local_storekit_test: true,
      },
    });
  },

  /**
   * Annule le renouvellement automatique d'un abonnement
   */
  cancelSubscription: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { userId },
      });
      if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(
          error,
          'Impossible de désactiver le renouvellement automatique.'
        ));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'La résiliation n’a pas été confirmée par Stripe.');
      }

      // Mettre à jour l'état local
      set((state) => ({
        subscription: {
          ...state.subscription,
          cancel_at_period_end: true,
        },
        loading: false,
      }));
      return data;
    } catch (error) {
      console.error('Erreur cancelSubscription:', error);
      set({ loading: false });
      throw error;
    }
  },

  /**
   * Met à jour l'abonnement après un paiement Stripe réussi
   */
  updateSubscription: async (userId, tier, stripeSubId) => {
    // Calculer la date d'expiration (30 jours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        tier,
        payment_provider: 'stripe',
        stripe_sub_id: stripeSubId,
        stripe_subscription_id: stripeSubId,
        expires_at: expiresAt.toISOString(),
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (error) throw error;
    set({ subscription: data });
    return data;
  },

  /**
   * Retourne le tier actuel
   */
  getCurrentTier: () => {
    return get().subscription?.tier || 'free';
  },
}));

export default useSubscriptionStore;
