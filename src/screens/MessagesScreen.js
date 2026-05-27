/**
 * Écran Messages - Liste des conversations
 * Affiche le dernier message, badge non-lu, avatar
 * Navigation vers ChatScreen pour chaque conversation
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../utils/constants';
import useMessages from '../hooks/useMessages';
import SkeletonMessages from '../components/SkeletonMessages';

const MessagesScreen = ({ navigation }) => {
  const { conversations, loading, fetchConversations } = useMessages();

  // Rafraîchir les conversations à chaque focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  /**
   * Formatage de la date du dernier message
   */
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  /**
   * Navigation vers la conversation
   */
  const handleConversationPress = (conversation) => {
    navigation.navigate('Chat', {
      partnerId: conversation.partnerId,
      partnerName: conversation.partner?.full_name || 'Utilisateur',
      partnerAvatar: conversation.partner?.avatar_url || '',
      partnerGender: conversation.partner?.gender,
    });
  };

  /**
   * Rendu d'une conversation
   */
  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Image
          source={
            item.partner?.avatar_url
              ? { uri: item.partner.avatar_url }
              : require('../../assets/default-avatar.png')
          }
          style={styles.avatar}
        />
        {/* Badge en ligne */}
        {item.partner?.is_online && <View style={styles.onlineDot} />}
      </View>

      {/* Contenu */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, item.unread > 0 && styles.nameBold]}>
            {item.partner?.full_name || 'Utilisateur'}
          </Text>
          <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.lastMessage, item.unread > 0 && styles.lastMessageBold]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {/* Badge non-lu */}
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread > 99 ? '99+' : item.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Liste des conversations */}
      {loading ? (
        <SkeletonMessages />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partnerId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={70} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>Pas de messages</Text>
              <Text style={styles.emptyText}>
                Commencez par liker des profils pour démarrer une conversation !
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.black,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.lightGray,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.secondary,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  content: {
    flex: 1,
    marginLeft: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  nameBold: {
    fontWeight: '800',
  },
  time: {
    fontSize: 12,
    color: COLORS.gray,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
    marginRight: 8,
  },
  lastMessageBold: {
    color: COLORS.black,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default MessagesScreen;
