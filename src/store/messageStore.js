/**
 * Store de messagerie Zustand
 * Gère les conversations, les messages, et le compteur quotidien
 */
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { MESSAGE_LIMITS } from '../utils/constants';

const useMessageStore = create((set, get) => ({
  // État
  conversations: [],      // Liste des conversations
  currentMessages: [],    // Messages de la conversation active
  dailyCount: 0,          // Compteur de messages du jour
  unreadTotal: 0,         // Total des messages non lus
  loading: false,
  activePartnerId: null,  // AJOUT : ID du partenaire de chat actif pour éviter le mélange de messages

  /**
   * AJOUT : Définit l'interlocuteur actif
   */
  setActivePartnerId: (partnerId) => set({ activePartnerId: partnerId }),

  /**
   * Récupère la liste des conversations de l'utilisateur
   * Trie par dernier message envoyé
   */
  fetchConversations: async (userId) => {
    set({ loading: true });
    try {
      // Récupérer tous les messages impliquant l'utilisateur
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, content, created_at, is_read, sender_id, receiver_id,
          sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url, gender, is_online),
          receiver:profiles!messages_receiver_id_fkey(id, full_name, avatar_url, gender, is_online)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Regrouper par conversation (par interlocuteur)
      const convMap = {};
      let unreadCount = 0;

      (data || []).forEach((msg) => {
        const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        const partner = msg.sender_id === userId ? msg.receiver : msg.sender;

        // Compter les non lus
        if (msg.receiver_id === userId && !msg.is_read) {
          unreadCount++;
        }

        // Garder seulement le dernier message par conversation
        if (!convMap[partnerId]) {
          convMap[partnerId] = {
            partnerId,
            partner,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unread: msg.receiver_id === userId && !msg.is_read ? 1 : 0,
          };
        } else if (msg.receiver_id === userId && !msg.is_read) {
          convMap[partnerId].unread++;
        }
      });

      const conversations = Object.values(convMap).sort(
        (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
      );

      set({ conversations, unreadTotal: unreadCount, loading: false });
    } catch (error) {
      console.error('Erreur fetchConversations:', error);
      set({ loading: false });
    }
  },

  /**
   * Récupère les messages d'une conversation spécifique
   */
  fetchMessages: async (userId, partnerId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Marquer les messages reçus comme lus immédiatement
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    set({ currentMessages: data || [] });
    return data;
  },

  /**
   * Envoie un message
   * Vérifie le compteur quotidien avant l'envoi
   */
  sendMessage: async (senderId, receiverId, content, subscriptionTier = 'free') => {
    // Vérifier la limite quotidienne
    const limit = MESSAGE_LIMITS[subscriptionTier] || MESSAGE_LIMITS.free;
    const currentCount = get().dailyCount;

    if (currentCount >= limit) {
      throw new Error(`Limite de ${limit} messages/jour atteinte. Passez à un abonnement supérieur.`);
    }

    // Insérer le message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le compteur quotidien
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('daily_message_counts').upsert({
      user_id: senderId,
      count_date: today,
      message_count: currentCount + 1,
    });

    // Mettre à jour l'état local
    set((state) => ({
      currentMessages: [...state.currentMessages, data],
      dailyCount: currentCount + 1,
    }));

    return data;
  },

  /**
   * Récupère le compteur de messages du jour
   */
  fetchDailyCount: async (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_message_counts')
      .select('message_count')
      .eq('user_id', userId)
      .eq('count_date', today)
      .single();

    const count = data?.message_count || 0;
    set({ dailyCount: count });
    return count;
  },

  /**
   * MODIFICATION : Abonne aux nouveaux messages en temps réel (souscription globale intelligente)
   */
  subscribeToMessages: (userId) => {
    const channel = supabase
      .channel(`global-chat-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Écoute tous les événements (INSERT, UPDATE) pour une synchronisation totale
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const activePartnerId = get().activePartnerId;

          // --- CAS 1 : NOUVEAU MESSAGE INSÉRÉ ---
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new;

            // Si le message me concerne (envoyé ou reçu)
            if (newMessage.sender_id === userId || newMessage.receiver_id === userId) {
              // 1. Rafraîchir instantanément la liste des conversations en arrière-plan
              get().fetchConversations(userId);

              // 2. Si c'est un message REÇU
              if (newMessage.receiver_id === userId) {
                // Si la conversation est ouverte avec cet expéditeur, on ajoute le message
                if (activePartnerId === newMessage.sender_id) {
                  set((state) => ({
                    currentMessages: [...state.currentMessages, newMessage],
                  }));

                  // Marquer automatiquement le message comme lu en base de données
                  await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .eq('id', newMessage.id);
                } else {
                  // Sinon, on incrémente uniquement le compteur de non-lus global
                  set((state) => ({
                    unreadTotal: state.unreadTotal + 1,
                  }));
                }
              }
            }
          }

          // --- CAS 2 : MESSAGE MIS À JOUR (ex: double coche de lecture ✓✓) ---
          if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new;

            if (updatedMessage.sender_id === userId || updatedMessage.receiver_id === userId) {
              // Mettre à jour l'état local si la conversation est active pour afficher ✓✓
              if (activePartnerId === updatedMessage.sender_id || activePartnerId === updatedMessage.receiver_id) {
                set((state) => ({
                  currentMessages: state.currentMessages.map((msg) =>
                    msg.id === updatedMessage.id ? updatedMessage : msg
                  ),
                }));
              }
              // Rafraîchir les conversations pour mettre à jour les badges
              get().fetchConversations(userId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Réinitialise les messages de la conversation active
   */
  clearCurrentMessages: () => set({ currentMessages: [] }),
}));

export default useMessageStore;
