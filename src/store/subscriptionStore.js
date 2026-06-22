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
      if (data && data.expires_at && new Date(data.expires_at) < new Date()) {
        // Si l'utilisateur a annulé le renouvellement, on repasse en gratuit
        if (data.cancel_at_period_end) {
          const { data: updated } = await supabase
            .from('subscriptions')
            .update({ 
              tier: 'free', 
              stripe_sub_id: null, 
              stripe_subscription_id: null, 
              expires_at: null,
              cancel_at_period_end: false 
            })
            .eq('user_id', userId)
            .select()
            .single();
          set({ subscription: updated || { tier: 'free' }, loading: false });
        } else {
          // Si le renouvellement automatique est activé, Stripe prolonge l'abonnement.
          // Le webhook Stripe met à jour expires_at en prod. On garde le plan actif.
          set({ subscription: data, loading: false });
        }
      } else {
        set({ subscription: data || { tier: 'free' }, loading: false });
      }
    } catch (error) {
      console.error('Erreur fetchSubscription:', error);
      set({ subscription: { tier: 'free' }, loading: false });
    }
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
