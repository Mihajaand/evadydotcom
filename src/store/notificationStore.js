import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  /**
   * Récupère la liste des notifications depuis Supabase
   */
  fetchNotifications: async (userId) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          notifier_id,
          type,
          content,
          is_read,
          created_at,
          notifier:profiles!notifications_notifier_id_fkey (
            id,
            full_name,
            avatar_url,
            gender
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const unread = (data || []).filter((n) => !n.is_read).length;
      set({ notifications: data || [], unreadCount: unread, loading: false });
    } catch (error) {
      console.error('Erreur fetchNotifications:', error);
      set({ loading: false });
    }
  },

  /**
   * Ajoute instantanément une notification reçue en temps réel
   * Élimine les doublons du même expéditeur pour le même type
   */
  addLocalNotification: (notif) => {
    set((state) => {
      // Filtrer et retirer toute notification du même type provenant du même expéditeur
      const filteredList = state.notifications.filter(
        (n) => !(n.type === notif.type && n.notifier_id === notif.notifier_id)
      );

      const exists = filteredList.some((n) => n.id === notif.id);
      if (exists) return state;

      const updatedList = [notif, ...filteredList];
      const unread = updatedList.filter((n) => !n.is_read).length;
      return { notifications: updatedList, unreadCount: unread };
    });
  },

  /**
   * Supprime une notification de la base et de l'état local
   */
  deleteNotification: async (notifId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notifId);

      if (error) throw error;

      set((state) => {
        const updatedList = state.notifications.filter((n) => n.id !== notifId);
        const unread = updatedList.filter((n) => !n.is_read).length;
        return { notifications: updatedList, unreadCount: unread };
      });
    } catch (error) {
      console.error('Erreur deleteNotification:', error);
    }
  },

  /**
   * Marque toutes les notifications comme lues
   */
  markAllAsRead: async (userId) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      set((state) => {
        const updatedList = state.notifications.map((n) => ({ ...n, is_read: true }));
        return { notifications: updatedList, unreadCount: 0 };
      });
    } catch (error) {
      console.error('Erreur markAllAsRead:', error);
    }
  },
}));

export default useNotificationStore;
