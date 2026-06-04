import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';

const NotificationsScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const { notifications, loading, fetchNotifications, deleteNotification, markAllAsRead } = useNotificationStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
      markAllAsRead(user.id);
    }
  }, [user?.id]);

  /**
   * Formate la date de notification en format relatif (ex: "il y a 5 min")
   */
  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return `Il y a ${diffDays} j`;
  };

  const handleDelete = (id) => {
    deleteNotification(id);
  };

  const handleNotifPress = (item) => {
    if (item.type === 'message') {
      navigation.navigate('Chat', {
        partnerId: item.notifier?.id,
        partnerName: item.notifier?.full_name || 'Utilisateur',
        partnerAvatar: item.notifier?.avatar_url || '',
        partnerGender: item.notifier?.gender,
      });
    } else if (item.type === 'like') {
      navigation.navigate('UserProfile', {
        userId: item.notifier?.id,
      });
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isReport = item.type === 'report';
    const isMessage = item.type === 'message';
    const avatarUrl = item.notifier?.avatar_url;
    const name = item.notifier?.full_name || 'Quelqu\'un';

    return (
      <View style={[styles.card, !item.is_read && styles.unreadCard]}>
        {/* Clic sur l'avatar ou le texte pour naviguer */}
        <TouchableOpacity
          style={styles.clickableArea}
          onPress={() => handleNotifPress(item)}
          activeOpacity={0.8}
        >
          {/* Avatar */}
          {isReport ? (
            <View style={[styles.iconContainer, styles.reportIconBg]}>
              <Ionicons name="warning" size={22} color="#FF9500" />
            </View>
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.iconContainer, styles.defaultAvatarBg]}>
              <Ionicons
                name={item.type === 'like' ? 'heart' : 'chatbubble'}
                size={20}
                color={item.type === 'like' ? '#FF2D55' : COLORS.primary}
              />
            </View>
          )}

          {/* Texte et Temps (style Instagram) */}
          <View style={styles.detailsContainer}>
            <Text style={styles.notifText}>
              {isReport ? (
                <Text>{item.content}</Text>
              ) : isMessage ? (
                <Text>
                  <Text style={styles.boldText}>{name}</Text> vous a envoyé un message.
                </Text>
              ) : (
                <Text>
                  <Text style={styles.boldText}>{name}</Text> {item.content}
                </Text>
              )}
              <Text style={styles.timeText}> {formatRelativeTime(item.created_at)}</Text>
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton d'action à droite (Instagram-like) et suppression */}
        <View style={styles.rightActions}>
          {!isReport && (
            <TouchableOpacity
              onPress={() => handleNotifPress(item)}
              style={[
                styles.actionBtn,
                isMessage ? styles.messageBtnBg : styles.likeBtnBg,
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {isMessage ? 'Répondre' : 'Profil'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Chargement */}
      {loading && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="heart-dislike-outline" size={60} color={COLORS.gray} />
          </View>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>
            Vous n'avez reçu aucune notification pour le moment. Dès qu'un utilisateur aimera votre profil ou vous enverra un message, cela apparaîtra ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  unreadCard: {
    backgroundColor: 'rgba(241, 62, 147, 0.02)',
  },
  clickableArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightGray,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportIconBg: {
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
  },
  defaultAvatarBg: {
    backgroundColor: COLORS.lightGray,
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  notifText: {
    fontSize: 14,
    color: COLORS.black,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBtnBg: {
    backgroundColor: '#0095F6', // Bleu officiel Instagram
  },
  likeBtnBg: {
    backgroundColor: '#EFEFEF', // Gris clair Instagram
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Spécifique texte pour bouton gris
  actionBtnTextDark: {
    color: COLORS.black,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
