/**
 * Store d'abonnement Zustand
 * Gère les plans, les paiements Stripe, et l'état de l'abonnement
 */
import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useSubscriptionStore = create((set, get) => ({
  // État
  subscription: null,   // { tier, expires_at, stripe_sub_id }
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
        // Abonnement expiré → remettre en gratuit
        const { data: updated } = await supabase
          .from('subscriptions')
          .update({ tier: 'free', stripe_sub_id: null, expires_at: null })
          .eq('user_id', userId)
          .select()
          .single();
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
        expires_at: expiresAt.toISOString(),
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
