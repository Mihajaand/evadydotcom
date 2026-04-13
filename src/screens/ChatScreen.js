/**
 * Écran de Chat - Conversation en temps réel
 * 
 * RÈGLES CRITIQUES:
 * - BLOQUE les messages si même genre (vérification côté client + RLS)
 * - Bouton Signaler visible UNIQUEMENT si l'utilisateur est FEMME et le partenaire est HOMME
 * - Respecte la limite quotidienne de messages selon l'abonnement
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MESSAGE_LIMITS, REPORT_REASONS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';
import useSubscriptionStore from '../store/subscriptionStore';
import { supabase } from '../supabase/client';

const ChatScreen = ({ route, navigation }) => {
  const { partnerId, partnerName, partnerAvatar, partnerGender } = route.params;

  const { user, profile } = useAuthStore();
  const { currentMessages, fetchMessages, sendMessage, dailyCount, fetchDailyCount, clearCurrentMessages } = useMessageStore();
  const { subscription } = useSubscriptionStore();

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  // Tier actuel de l'abonnement
  const currentTier = subscription?.tier || 'free';
  const messageLimit = MESSAGE_LIMITS[currentTier];
  const canSendMore = dailyCount < messageLimit;

  /**
   * VÉRIFICATION CRITIQUE: Bloquer si même genre
   */
  const isSameGender = profile?.gender === partnerGender;

  /**
   * Le bouton signaler est visible UNIQUEMENT si:
   * - L'utilisateur actuel est une FEMME
   * - Le partenaire est un HOMME
   */
  const canReport = profile?.gender === 'FEMALE' && partnerGender === 'MALE';

  /**
   * Charger les messages au montage
   */
  useEffect(() => {
    loadMessages();
    fetchDailyCount();

    // Abonnement temps réel
    const channel = supabase
      .channel(`chat-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${partnerId}`,
        },
        (payload) => {
          if (payload.new.receiver_id === user.id) {
            useMessageStore.setState((state) => ({
              currentMessages: [...state.currentMessages, payload.new],
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearCurrentMessages();
    };
  }, [partnerId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      await fetchMessages(user.id, partnerId);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Envoyer un message
   */
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    // BLOCAGE: même genre
    if (isSameGender) {
      Alert.alert('Action bloquée', 'Vous ne pouvez pas envoyer de messages à une personne du même genre.');
      return;
    }

    // Vérifier la limite quotidienne
    if (!canSendMore) {
      Alert.alert('Limite atteinte', `Vous avez atteint votre limite de ${messageLimit} messages/jour. Améliorez votre abonnement !`);
      navigation.navigate('Subscription');
      return;
    }

    setSending(true);
    setInputText('');

    try {
      await sendMessage(user.id, partnerId, text, currentTier);
    } catch (error) {
      Alert.alert('Erreur', error.message);
      setInputText(text); // Remettre le texte si erreur
    } finally {
      setSending(false);
    }
  };

  /**
   * Signaler un utilisateur (FEMME → HOMME uniquement)
   */
  const handleReport = () => {
    Alert.alert(
      'Signaler cet utilisateur',
      'Sélectionnez une raison :',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: async () => {
            try {
              await supabase.from('reports').insert({
                reporter_id: user.id,
                reported_id: partnerId,
                reason,
              });
              Alert.alert('Signalement envoyé', 'Merci, notre équipe examinera ce profil.');
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  /**
   * Scroll automatique vers le dernier message
   */
  useEffect(() => {
    if (currentMessages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentMessages.length]);

  /**
   * Rendu d'un message
   */
  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
          {new Date(item.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {isMe && item.is_read && ' ✓✓'}
        </Text>
      </View>
    );
  };

  // Écran de blocage si même genre
  if (isSameGender) {
    return (
      <View style={styles.blockedContainer}>
        <Ionicons name="ban-outline" size={60} color={COLORS.danger} />
        <Text style={styles.blockedTitle}>Conversation bloquée</Text>
        <Text style={styles.blockedText}>
          Les messages entre personnes du même genre ne sont pas autorisés.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>

        <Image
          source={
            partnerAvatar
              ? { uri: partnerAvatar }
              : require('../../assets/default-avatar.png')
          }
          style={styles.headerAvatar}
        />

        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{partnerName}</Text>
          <Text style={styles.headerStatus}>
            {dailyCount}/{messageLimit === Infinity ? '∞' : messageLimit} msg aujourd'hui
          </Text>
        </View>

        {/* Bouton signaler (FEMME uniquement) */}
        {canReport && (
          <TouchableOpacity onPress={handleReport} style={styles.reportBtn}>
            <Ionicons name="flag-outline" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={50} color={COLORS.gray} />
              <Text style={styles.emptyText}>Commencez la conversation !</Text>
            </View>
          }
        />
      )}

      {/* Barre de saisie */}
      <View style={styles.inputBar}>
        {!canSendMore && (
          <TouchableOpacity
            style={styles.limitBanner}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Ionicons name="warning-outline" size={16} color={COLORS.white} />
            <Text style={styles.limitText}>
              Limite atteinte ! Passez au niveau supérieur →
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={canSendMore ? 'Votre message...' : 'Limite atteinte'}
            placeholderTextColor={COLORS.gray}
            style={styles.input}
            multiline
            maxLength={1000}
            editable={canSendMore}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending || !canSendMore) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || !canSendMore}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 40,
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.danger,
    marginTop: 16,
  },
  blockedText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  goBackBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  goBackText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
  },
  headerStatus: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 1,
  },
  reportBtn: {
    padding: 8,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.lightGray,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: COLORS.white,
  },
  theirMessageText: {
    color: COLORS.black,
  },
  messageTime: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  limitText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: COLORS.black,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.gray,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 16,
    marginTop: 12,
  },
});

export default ChatScreen;
