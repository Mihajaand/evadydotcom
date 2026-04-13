/**
 * Store d'authentification Zustand
 * Gère l'état de connexion, le profil utilisateur, et les actions auth
 */
import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useAuthStore = create((set, get) => ({
  // État
  user: null,        // Objet auth.user de Supabase
  profile: null,     // Profil depuis la table profiles
  loading: true,     // Chargement initial
  
  /**
   * Définit l'utilisateur authentifié
   */
  setUser: (user) => set({ user }),

  /**
   * Définit le profil utilisateur
   */
  setProfile: (profile) => set({ profile }),

  /**
   * Définit l'état de chargement
   */
  setLoading: (loading) => set({ loading }),

  /**
   * Connexion par email + mot de passe
   */
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    set({ user: data.user });
    await get().fetchProfile(data.user.id);
    return data;
  },

  /**
   * Inscription avec création de profil
   */
  signup: async ({ email, password, fullName, gender, birthdate, latitude, longitude }) => {
    // 1. Créer le compte auth
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;

    // 2. Créer le profil + abonnement via fonction SECURITY DEFINER (bypass RLS)
    const { error: rpcError } = await supabase.rpc('create_profile', {
      user_id: data.user.id,
      user_gender: gender,
      user_full_name: fullName,
      user_birthdate: birthdate,
      user_latitude: latitude || 0,
      user_longitude: longitude || 0,
    });
    if (rpcError) throw rpcError;

    set({ user: data.user });
    await get().fetchProfile(data.user.id);
    return data;
  },

  /**
   * Déconnexion
   */
  logout: async () => {
    // Mettre le statut hors-ligne
    const userId = get().user?.id;
    if (userId) {
      await supabase
        .from('profiles')
        .update({ is_online: false })
        .eq('id', userId);
    }
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  /**
   * Récupère le profil depuis Supabase
   */
  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    set({ profile: data });
    
    // Mettre le statut en ligne
    await supabase
      .from('profiles')
      .update({ is_online: true })
      .eq('id', userId);
    
    return data;
  },

  /**
   * Met à jour le profil
   */
  updateProfile: async (updates) => {
    const userId = get().user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    set({ profile: data });
    return data;
  },

  /**
   * Réinitialisation du mot de passe
   */
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    if (error) throw error;
  },

  /**
   * Initialise la session (appelée au démarrage)
   */
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      }
    } catch (error) {
      console.error('Erreur initialisation auth:', error);
    } finally {
      set({ loading: false });
    }
  },
}));

export default useAuthStore;
