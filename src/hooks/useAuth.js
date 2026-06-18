import { useEffect, useRef } from 'react';
import { supabase } from '../supabase/client';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';
import useRealtimeNotifications from './useRealtimeNotifications';
import useMaintenanceStore from '../store/maintenanceStore';

const useAuth = () => {
  const { user, profile, loading, initialize, setUser, fetchProfile, setLoading } = useAuthStore();
  const subscribeToMessages = useMessageStore((state) => state.subscribeToMessages);
  const fetchConversations = useMessageStore((state) => state.fetchConversations);
  const initializeMaintenance = useMaintenanceStore((state) => state.initialize);

  // Activer l'écoute des notifications temps réel (Likes, Messages, Signalements)
  useRealtimeNotifications();

  const profileChannel = useRef(null);

  useEffect(() => {
    // Initialiser la session et le store de maintenance au montage
    initialize();
    initializeMaintenance();

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
      if (profileChannel.current) {
        supabase.removeChannel(profileChannel.current);
      }
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

  useEffect(() => {
    if (!user?.id) return;

    // Se (ré)abonner aux changements du profil pour détecter is_active instantanément
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        async (payload) => {
          if (payload.new) {
            try {
              await fetchProfile(user.id);
            } catch (error) {
              console.error('Erreur mise à jour profil temps réel:', error);
            }
          }
        }
      )
      .subscribe();

    profileChannel.current = channel;

    return () => {
      if (profileChannel.current) {
        supabase.removeChannel(profileChannel.current);
        profileChannel.current = null;
      }
    };
  }, [user?.id, fetchProfile]);

  return { user, profile, loading };
};

export default useAuth;




