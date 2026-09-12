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
  ActivityIndicator,
  Modal,
  Keyboard,
} from 'react-native';
import { customAlert } from '../utils/helpers';

const Alert = {
  alert: customAlert,
};
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MESSAGE_LIMITS, REPORT_REASONS } from '../utils/constants';
import { validateMessage } from '../utils/forbiddenWords';
import useAuthStore from '../store/authStore';
import useMessageStore from '../store/messageStore';
import useSubscriptionStore from '../store/subscriptionStore';
import { supabase } from '../supabase/client';

const ChatScreen = ({ route, navigation }) => {
  const { partnerId, partnerName, partnerAvatar, partnerGender } = route.params;

  const { user, profile } = useAuthStore();
  const { currentMessages, fetchMessages, sendMessage, deleteMessage, dailyCount, fetchDailyCount, clearCurrentMessages, setActivePartnerId } = useMessageStore();
  const { subscription, fetchSubscription } = useSubscriptionStore();

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedFullImage, setSelectedFullImage] = useState(null);
  const flatListRef = useRef(null);

  // Tier actuel de l'abonnement
  const currentTier = subscription?.tier || 'free';
  const isFemale = profile?.gender === 'FEMALE';
  const messageLimit = isFemale ? Infinity : MESSAGE_LIMITS[currentTier];
  const canSendMore = isFemale ? true : (dailyCount < messageLimit);

  /**
   * VÉRIFICATION CRITIQUE: Bloquer si même genre
   */
  const isSameGender = profile?.gender === partnerGender;

  /**
   * Le bouton signaler est visible UNIQUEMENT si:
   * - L'utilisateur actuel est un HOMME
   * - Le partenaire est une FEMME
   */
  const canReport = profile?.gender === 'MALE' && partnerGender === 'FEMALE';

  /**
   * Charger les messages au montage
   */
  useEffect(() => {
    loadMessages();
    
    if (user?.id) {
      fetchDailyCount(user.id);
      fetchSubscription(user.id);
    }

    // MODIFICATION : Définir ce partenaire comme la conversation active dans le store
    setActivePartnerId(partnerId);

    // Note : L'abonnement temps réel global (dans MessagesScreen) s'occupe déjà d'écouter
    // et d'ajouter les nouveaux messages au store currentMessages sans doublon ni pollution.

    return () => {
      // MODIFICATION : Réinitialiser au démontage
      setActivePartnerId(null);
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
      // MODÉRATION : Vérification des mots interdits, réseaux sociaux et coordonnées
      const validation = validateMessage(text);
      if (!validation.isValid) {
        Alert.alert('Message non autorisé', validation.reason);
        setInputText(text);
        return;
      }

      await sendMessage(user.id, partnerId, text, currentTier, isFemale);
    } catch (error) {
      Alert.alert('Erreur', error.message);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  /**
   * Ouvre le modal de signalement
   */
  const handleReport = () => {
    setReportModalVisible(true);
  };

  /**
   * Soumet le signalement avec la raison choisie
   */
  const submitReport = async (reason) => {
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: partnerId,
        reason,
      });
      if (error) throw error;
      setReportModalVisible(false);
      Alert.alert('Signalement envoyé', 'Merci, notre équipe examinera ce profil.');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  /**
   * Sélectionne une photo depuis la galerie et l'envoie directement (style Facebook)
   */
  const handleSendImage = async () => {
    if (isSameGender) {
      Alert.alert('Action bloquée', 'Vous ne pouvez pas envoyer de messages à une personne du même genre.');
      return;
    }

    if (!canSendMore) {
      Alert.alert('Limite atteinte', `Vous avez atteint votre limite de ${messageLimit} messages/jour. Améliorez votre abonnement !`);
      navigation.navigate('Subscription');
      return;
    }

    // Fermer le clavier avant d'ouvrir la galerie
    Keyboard.dismiss();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    // Forcer la fermeture du clavier au retour de la galerie (fix layout Android)
    Keyboard.dismiss();

    if (result.canceled) return;

    const file = result.assets[0];
    let fileExt = 'jpg';
    let uploadBody;
    let contentType = 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      uploadBody = blob;
      contentType = blob.type || 'image/jpeg';
      fileExt = contentType.split('/').pop() || 'jpg';
    } else {
      fileExt = file.uri.split('.').pop().toLowerCase();
      const base64 = file.base64;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      uploadBody = bytes.buffer;
      contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
    }

    const fileName = `chats/${user.id}/${Date.now()}.${fileExt}`;

    setSending(true);
    try {
      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, uploadBody, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // URL publique
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Envoyer le message image directement
      await sendMessage(user.id, partnerId, `[IMAGE]:${urlData.publicUrl}`, currentTier, isFemale);
    } catch (error) {
      Alert.alert('Erreur lors de l\'envoi de la photo', error.message);
    } finally {
      setSending(false);
    }
  };

  /**
   * Gère l'appui long sur un message pour sa suppression
   */
  const handleLongPressMessage = (message) => {
    Alert.alert(
      'Supprimer le message',
      'Voulez-vous supprimer ce message pour tout le monde ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(message.id);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le message.');
            }
          },
        },
      ]
    );
  };

  /**
   * Rendu d'un message (avec support image, avatar cliquable et suppression)
   */
  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user.id;
    const isImage = item.content?.startsWith('[IMAGE]:');
    const imageUrl = isImage ? item.content.substring(8) : null;

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        {!isMe && (
          <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: partnerId })}>
            <Image
              source={
                partnerAvatar
                  ? { uri: partnerAvatar }
                  : require('../../assets/default-avatar.png')
              }
              style={styles.messageAvatar}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.95}
          onLongPress={() => isMe && handleLongPressMessage(item)}
          style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}
        >
          {isImage ? (
            <TouchableOpacity onPress={() => setSelectedFullImage(imageUrl)}>
              <Image source={{ uri: imageUrl }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
              {item.content}
            </Text>
          )}
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {new Date(item.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {isMe && item.is_read && ' ✓✓'}
          </Text>
        </TouchableOpacity>
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>

        {/* <Image
          source={require('../../assets/logo.png')}
          style={{ width: 30, height: 30, marginRight: 8 }}
          resizeMode="contain"
        /> */}

        <TouchableOpacity
          style={styles.headerInfoContainer}
          onPress={() => navigation.navigate('UserProfile', { userId: partnerId })}
          activeOpacity={0.7}
        >
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
            {profile?.gender === 'MALE' && (
              <Text style={styles.headerStatus}>
                {dailyCount}/{messageLimit === Infinity ? '∞' : messageLimit} msg aujourd'hui
              </Text>
            )}
          </View>
        </TouchableOpacity>

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
          data={[...currentMessages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          inverted
          ListEmptyComponent={
  <View style={[styles.center, { transform: [{ rotate: '180deg' }] }]}>
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
          <TouchableOpacity
            style={styles.imagePickerBtn}
            onPress={handleSendImage}
            disabled={sending || !canSendMore}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="image-outline" size={24} color={canSendMore ? COLORS.primary : COLORS.gray} />
            )}
          </TouchableOpacity>
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

      {/* Modal de Signalement Stylé */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Bouton de Fermeture X */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setReportModalVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color={COLORS.darkGray} />
            </TouchableOpacity>

            {/* En-tête */}
            <View style={styles.modalHeaderTitleRow}>
              <Ionicons name="warning" size={28} color={COLORS.danger} />
              <Text style={styles.modalTitle}>Signaler cet utilisateur</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Veuillez sélectionner la raison du signalement de {partnerName} :
            </Text>

            {/* Liste des raisons */}
            {submittingReport ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modalLoadingText}>Traitement du signalement...</Text>
              </View>
            ) : (
              <View style={styles.reasonsContainer}>
                {REPORT_REASONS.map((reason, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.reasonOption}
                    onPress={() => submitReport(reason)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reasonOptionText}>{reason}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.modalFooterText}>
              Votre signalement restera strictement confidentiel et sera examiné par nos modérateurs sous 24 heures.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal pour afficher l'image du chat en plein écran */}
      <Modal
        visible={selectedFullImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedFullImage(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedFullImage(null)}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          {selectedFullImage && (
            <View style={styles.modalImageContainer}>
              <Image
                source={{ uri: selectedFullImage }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.darkGray,
    lineHeight: 20,
    marginBottom: 20,
  },
  reasonsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  reasonOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  modalFooterText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    width: '100%',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: COLORS.lightGray,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imagePickerBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    padding: 8,
    flexDirection: 'row',
    position: 'relative',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 4,
  },
  imagePreview: {
    width: 70,
    height: 70,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  clearImageBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  headerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});

export default ChatScreen;
