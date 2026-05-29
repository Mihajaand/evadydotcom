/**
 * Hook d'authentification
 * Écoute les changements de session Supabase et initialise l'auth
 */
import { useEffect } from 'react';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';

const useAuth = () => {
  const { user, profile, loading, initialize, setUser, fetchProfile, setLoading } = useAuthStore();
  const subscribeToMessages = useMessageStore((state) => state.subscribeToMessages);
  const fetchConversations = useMessageStore((state) => state.fetchConversations);

  useEffect(() => {
    // Initialiser la session au montage
    initialize();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            console.error('Erreur chargement profil:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    // Nettoyage à la destruction
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Abonnement global aux messages en temps réel pour synchronisation complète dans toute l'application
  useEffect(() => {
    if (!user?.id) return;

    // Charger immédiatement le compteur initial des messages non lus sur la barre d'onglets
    fetchConversations(user.id);

    const unsubscribe = subscribeToMessages(user.id);
    return () => {
      unsubscribe();
    };
  }, [user?.id, subscribeToMessages, fetchConversations]);

  return { user, profile, loading };
};

export default useAuth;



