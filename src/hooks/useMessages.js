/**
 * Hook pour les messages en temps réel
 * Gère l'abonnement aux messages et le compteur quotidien
 */
import { useEffect, useCallback } from 'react';
import useMessageStore from '../store/messageStore';
import useAuthStore from '../store/authStore';

const useMessages = () => {
  const user = useAuthStore((state) => state.user);
  const {
    conversations,
    currentMessages,
    dailyCount,
    unreadTotal,
    loading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    fetchDailyCount,
    clearCurrentMessages,
    resetUnreadTotal,
  } = useMessageStore();

  const fetchConversationsBound = useCallback(() => {
    if (user?.id) fetchConversations(user.id);
  }, [user?.id, fetchConversations]);

  const fetchMessagesBound = useCallback((partnerId) => {
    if (user?.id) return fetchMessages(user.id, partnerId);
  }, [user?.id, fetchMessages]);

  const sendMessageBound = useCallback((receiverId, content, tier) => {
    return sendMessage(user?.id, receiverId, content, tier);
  }, [user?.id, sendMessage]);

  const fetchDailyCountBound = useCallback(() => {
    if (user?.id) return fetchDailyCount(user.id);
  }, [user?.id, fetchDailyCount]);

  useEffect(() => {
    if (!user?.id) return;

    // Charger les conversations et le compteur
    fetchConversations(user.id);
    fetchDailyCount(user.id);
  }, [user?.id]);

  return {
    conversations,
    currentMessages,
    dailyCount,
    unreadTotal,
    loading,
    fetchConversations: fetchConversationsBound,
    fetchMessages: fetchMessagesBound,
    sendMessage: sendMessageBound,
    fetchDailyCount: fetchDailyCountBound,
    clearCurrentMessages,
    resetUnreadTotal,
  };
};

export default useMessages;
