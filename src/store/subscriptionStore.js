/**
 * Store d'abonnement Zustand
 * Gère les plans, les paiements Stripe, et l'état de l'abonnement
 */
import { create } from 'zustand';
import { supabase } from '../supabase/client';

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
        // Si l'utilisateur a annulé le renouvellement, on repasse en gratuit
        const { data: updated, error: updateError } = await supabase
            .from('subscriptions')
            .update({ 
              tier: 'free', 
              stripe_sub_id: null, 
              stripe_subscription_id: null, 
              apple_original_transaction_id: null,
              apple_transaction_id: null,
              apple_product_id: null,
              payment_provider: null,
              expires_at: null,
              cancel_at_period_end: false 
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

    if (error) throw error;
    if (!data?.active || !data?.subscription) {
      throw new Error(data?.error || 'Aucun abonnement Apple actif trouvé.');
    }

    set({ subscription: data.subscription });
    return data.subscription;
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
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

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
