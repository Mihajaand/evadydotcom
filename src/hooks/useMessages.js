/**
 * Hook pour les messages en temps réel
 * Gère l'abonnement aux messages et le compteur quotidien
 */
import { useEffect } from 'react';
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
  } = useMessageStore();

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
    fetchConversations: () => fetchConversations(user?.id),
    fetchMessages: (partnerId) => fetchMessages(user?.id, partnerId),
    sendMessage: (receiverId, content, tier) => sendMessage(user?.id, receiverId, content, tier),
    fetchDailyCount: () => fetchDailyCount(user?.id),
    clearCurrentMessages,
  };
};

export default useMessages;
