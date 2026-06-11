/**
 * AdminProfileDetailScreen — Détail complet d'un profil utilisateur (vue admin)
 * Thème identique à l'application principale (blanc, rose #F13E93)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { calculateAge } from '../utils/helpers';
import { customAlert } from '../utils/helpers';
import { supabase } from '../supabase/client';

const Alert = { alert: customAlert };
const { width } = Dimensions.get('window');

const TIER_LABELS = {
  free:    { text: 'Gratuit', color: '#9E9E9E', bg: '#F5F5F5',             icon: 'ellipse-outline' },
  basic:   { text: 'Basic',   color: '#5DD3B6', bg: 'rgba(93,211,182,0.1)',icon: 'star-outline'     },
  premium: { text: 'Premium', color: '#F13E93', bg: 'rgba(241,62,147,0.1)',icon: 'star'             },
  vip:     { text: 'VIP',     color: '#FF9500', bg: 'rgba(255,149,0,0.1)', icon: 'diamond'          },
};

const AdminProfileDetailScreen = ({ route, navigation }) => {
  const { profileId } = route.params;

  const [profile,       setProfile]       = useState(null);
  const [photos,        setPhotos]        = useState([]);
  const [subscription,  setSubscription]  = useState(null);
  const [reports,       setReports]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // 1. Profil
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      if (pErr) throw pErr;
      setProfile(p);

      // 2. Photos
      const { data: ph } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: true });
      setPhotos(ph || []);

      // 3. Abonnement
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', profileId)
        .single();
      setSubscription(sub || { tier: 'free' });

      // 4. Signalements reçus
      const { data: rep } = await supabase
        .from('reports')
        .select('*')
        .eq('reported_id', profileId)
        .order('created_at', { ascending: false });
      setReports(rep || []);

    } catch (err) {
      console.error('Erreur chargement détail profil:', err);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du profil…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-remove-outline" size={50} color={COLORS.gray} />
        <Text style={styles.loadingText}>Profil introuvable</Text>
        <TouchableOpacity style={styles.backFallbackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backFallbackText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const age      = calculateAge(profile.birthdate);
  const tier     = subscription?.tier || 'free';
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.free;
  const isActive = profile.is_active !== false;

  const InfoRow = ({ icon, label, value }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoIconBox}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <View style={styles.infoTexts}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    );
  };

  const TagChip = ({ label, color }) => (
    <View style={[styles.tagChip, color && { borderColor: color + '33', backgroundColor: color + '11' }]}>
      <Text style={[styles.tagChipText, color && { color }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header fixe */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil Admin</Text>
        {/* Statut compte */}
        <View style={[
          styles.statusPill,
          { backgroundColor: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isActive ? '#22C55E' : '#EF4444' }
          ]} />
          <Text style={[styles.statusText, { color: isActive ? '#22C55E' : '#EF4444' }]}>
            {isActive ? 'Actif' : 'Inactif'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Identité ──────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={
                profile.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/default-avatar.png')
              }
              style={styles.avatar}
            />
            {/* Badge abonnement */}
            <View style={[styles.tierBadge, { backgroundColor: tierInfo.bg, borderColor: tierInfo.color + '44' }]}>
              <Ionicons name={tierInfo.icon} size={12} color={tierInfo.color} />
              <Text style={[styles.tierBadgeText, { color: tierInfo.color }]}>
                {tierInfo.text}
              </Text>
            </View>
          </View>

          <Text style={styles.fullName}>{profile.full_name || '—'}</Text>
          <Text style={styles.ageGender}>
            {age ? `${age} ans · ` : ''}
            {profile.gender === 'MALE' ? '👨 Homme' : '👩 Femme'}
          </Text>

          {profile.bio ? (
            <Text style={styles.bio}>"{profile.bio}"</Text>
          ) : null}
        </View>

        {/* ── Informations Admin ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.primary} />
            {' '}Informations Admin
          </Text>

          <InfoRow icon="finger-print-outline"  label="ID"               value={profile.id} />
          <InfoRow icon="mail-outline"           label="Email"            value={profile.email} />
          <InfoRow icon="calendar-outline"       label="Inscrit le"       value={
            profile.created_at
              ? new Date(profile.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
              : null
          } />
          <InfoRow icon="time-outline"           label="Dernière activité" value={
            profile.updated_at
              ? new Date(profile.updated_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })
              : null
          } />
          <InfoRow icon="wifi-outline"           label="Statut en ligne"  value={profile.is_online ? '🟢 En ligne' : '⚫ Hors ligne'} />
          <InfoRow icon="location-outline"       label="Localisation GPS" value={
            profile.latitude && profile.longitude
              ? `${parseFloat(profile.latitude).toFixed(4)}, ${parseFloat(profile.longitude).toFixed(4)}`
              : null
          } />
        </View>

        {/* ── Informations Personnelles ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="person-outline" size={15} color={COLORS.primary} />
            {' '}Informations Personnelles
          </Text>

          <InfoRow icon="cake-outline"       label="Date de naissance" value={
            profile.birthdate
              ? new Date(profile.birthdate).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
              : null
          } />
          <InfoRow icon="resize-outline"     label="Taille"            value={profile.height} />
          <InfoRow icon="briefcase-outline"  label="Profession"        value={profile.profession} />
          <InfoRow icon="bookmark-outline"   label="Croyances"         value={profile.beliefs} />

          {/* Centres d'intérêt */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsLabel}>Centres d'intérêt</Text>
              <View style={styles.tagsRow}>
                {profile.interests.map((t) => (
                  <TagChip key={t} label={t} color={COLORS.primary} />
                ))}
              </View>
            </View>
          )}

          {/* Style de vie */}
          {profile.lifestyle && profile.lifestyle.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsLabel}>Style de vie</Text>
              <View style={styles.tagsRow}>
                {profile.lifestyle.map((t) => (
                  <TagChip key={t} label={t} color={COLORS.secondary} />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── Abonnement ────────────────────────────────────────────────── */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tierInfo.color }]}>
          <Text style={styles.cardTitle}>
            <Ionicons name="diamond-outline" size={15} color={tierInfo.color} />
            {' '}Abonnement
          </Text>
          <View style={styles.tierRow}>
            <View style={[styles.tierBig, { backgroundColor: tierInfo.bg }]}>
              <Ionicons name={tierInfo.icon} size={28} color={tierInfo.color} />
              <Text style={[styles.tierBigText, { color: tierInfo.color }]}>
                {tierInfo.text}
              </Text>
            </View>
            <View style={styles.tierMeta}>
              {subscription?.expires_at ? (
                <InfoRow icon="time-outline" label="Expire le" value={
                  new Date(subscription.expires_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })
                } />
              ) : (
                <Text style={styles.infoValue}>Plan sans expiration</Text>
              )}
              {subscription?.stripe_sub_id ? (
                <InfoRow icon="card-outline" label="Stripe ID" value={
                  subscription.stripe_sub_id.substring(0, 18) + '…'
                } />
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Galerie Photos ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="images-outline" size={15} color={COLORS.primary} />
            {' '}Photos ({photos.length}/6)
          </Text>
          {photos.length === 0 ? (
            <Text style={styles.emptyText}>Aucune photo</Text>
          ) : (
            <View style={styles.photosGrid}>
              {photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => setSelectedPhoto(photo)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: photo.url }} style={styles.photoThumb} />
                  {photo.is_profile && (
                    <View style={styles.profilePhotoBadge}>
                      <Text style={styles.profilePhotoBadgeText}>Profil</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Signalements ─────────────────────────────────────────────── */}
        <View style={[
          styles.card,
          reports.length > 0 && { borderLeftWidth: 3, borderLeftColor: COLORS.danger }
        ]}>
          <Text style={styles.cardTitle}>
            <Ionicons name="flag-outline" size={15} color={reports.length > 0 ? COLORS.danger : COLORS.gray} />
            {' '}Signalements reçus ({reports.length})
          </Text>
          {reports.length === 0 ? (
            <View style={styles.noReportsRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.secondary} />
              <Text style={styles.noReportsText}>Aucun signalement — Compte sain</Text>
            </View>
          ) : (
            reports.map((r, idx) => (
              <View key={r.id || idx} style={styles.reportItem}>
                <View style={styles.reportItemHeader}>
                  <Ionicons name="flag" size={13} color={COLORS.danger} />
                  <Text style={styles.reportReason}>{r.reason || 'Raison non spécifiée'}</Text>
                </View>
                <Text style={styles.reportMeta}>
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                  {' · '}Signaleur : {r.reporter_id ? r.reporter_id.substring(0, 8) + '…' : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Padding bas */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal photo plein écran ──────────────────────────────────────── */}
      {selectedPhoto && (
        <TouchableOpacity
          style={styles.photoModal}
          activeOpacity={1}
          onPress={() => setSelectedPhoto(null)}
        >
          <Image
            source={{ uri: selectedPhoto.url }}
            style={styles.photoModalImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
};

const PHOTO_SIZE = (width - 48 - 12) / 3;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: {
    flex: 1, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText:       { color: COLORS.gray, fontSize: 14 },
  backFallbackBtn:   { marginTop: 8 },
  backFallbackText:  { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.black },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Scroll ──────────────────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 20,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.primary,
  },
  tierBadge: {
    position: 'absolute', bottom: -4, right: -6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '800' },
  fullName:  { fontSize: 22, fontWeight: '900', color: COLORS.black, textAlign: 'center' },
  ageGender: { fontSize: 15, color: COLORS.gray, marginTop: 4 },
  bio: {
    marginTop: 12, fontSize: 14, color: COLORS.darkGray,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 16,
  },

  // ── Cards ────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.black,
    marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── InfoRow ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 12,
  },
  infoIconBox: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(241,62,147,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 14, color: COLORS.black, fontWeight: '600', marginTop: 1 },

  // ── Tags ─────────────────────────────────────────────────────────────────
  tagsSection: { marginTop: 4, marginBottom: 8 },
  tagsLabel:   { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.lightGray,
  },
  tagChipText: { fontSize: 12, fontWeight: '600', color: COLORS.darkGray },

  // ── Abonnement ───────────────────────────────────────────────────────────
  tierRow:     { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  tierBig: {
    alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 16, borderRadius: 12, minWidth: 80,
  },
  tierBigText: { fontSize: 13, fontWeight: '800' },
  tierMeta:    { flex: 1 },

  // ── Photos ───────────────────────────────────────────────────────────────
  photosGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoItem:        { position: 'relative' },
  photoThumb:       { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10, backgroundColor: COLORS.lightGray },
  profilePhotoBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: COLORS.primary, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  profilePhotoBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  emptyText: { color: COLORS.gray, fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  // ── Signalements ─────────────────────────────────────────────────────────
  noReportsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  noReportsText: { color: COLORS.secondary, fontSize: 13, fontWeight: '600' },
  reportItem: {
    padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,68,68,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.12)',
    marginBottom: 8, gap: 4,
  },
  reportItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reportReason:     { fontSize: 13, fontWeight: '700', color: COLORS.black, flex: 1 },
  reportMeta:       { fontSize: 11, color: COLORS.gray },

  // ── Modal photo plein écran ───────────────────────────────────────────────
  photoModal: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999,
  },
  photoModalImage: { width: '100%', height: '80%' },
  photoModalClose: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
});

export default AdminProfileDetailScreen;
