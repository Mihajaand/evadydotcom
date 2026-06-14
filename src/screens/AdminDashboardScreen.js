/**
 * AdminDashboardScreen — Dashboard Admin E-VADY
 * Thème identique à l'application principale (blanc, rose #F13E93)
 * Navigation vers le détail d'un profil au clic
 * Données en temps réel via Supabase Realtime
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { customAlert } from '../utils/helpers';
import { supabase } from '../supabase/client';
import useAdminStore from '../store/adminStore';

const Alert = { alert: customAlert };

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TIER_LABELS = {
  free:    { text: 'Gratuit', color: '#9E9E9E',  bg: '#F5F5F5'              },
  basic:   { text: 'Basic',   color: '#5DD3B6',  bg: 'rgba(93,211,182,0.1)' },
  premium: { text: 'Premium', color: COLORS.primary, bg: 'rgba(241,62,147,0.1)' },
  vip:     { text: 'VIP ★',   color: '#FF9500',  bg: 'rgba(255,149,0,0.1)'  },
};

const AdminDashboardScreen = ({ navigation }) => {
  const { isAdminLoggedIn, adminLogout } = useAdminStore();

  const [profiles,          setProfiles]          = useState([]);
  const [filteredProfiles,  setFilteredProfiles]  = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [dbError,           setDbError]           = useState(null);

  const [searchQuery,  setSearchQuery]  = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [tierFilter,   setTierFilter]   = useState('ALL');

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReports,    setSelectedReports]    = useState([]);
  const [selectedReportUser, setSelectedReportUser] = useState('');

  const [stats, setStats] = useState({ totalProfiles: 0, totalReports: 0, totalActive: 0, totalInactive: 0 });

  const realtimeRef = useRef(null);

  // Sécurité : rediriger si non admin
  useEffect(() => {
    if (!isAdminLoggedIn) navigation.replace('Login');
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadAllData();
      setupRealtime();
    }
    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, [isAdminLoggedIn]);

  useEffect(() => {
    applyFilters();
  }, [profiles, searchQuery, genderFilter, tierFilter]);

  const handleSearchQueryChange = (value) => {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
    const isSecret = normalized === 'securityofgod' || normalized === 'securityodgod';

    if (isSecret) {
      setSearchQuery('');
      navigation.navigate('AdminMaintenance');
      return;
    }

    setSearchQuery(value);
  };

  // ── Temps réel ─────────────────────────────────────────────────────────────
  const setupRealtime = () => {
    // Use a unique channel name to avoid adding callbacks to an already-subscribed channel
    const channelName = `admin-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadAllData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => loadAllData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => loadAllData(true))
      .subscribe();

    // Remove any previous channel reference and store the new one
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    realtimeRef.current = channel;
  };

  // ── Chargement des données ─────────────────────────────────────────────────
  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    setDbError(null);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        await loadViaEdgeFunction(silent);
        return;
      }

      const { data: subsData    } = await supabase.from('subscriptions').select('user_id, tier');
      const { data: reportsData } = await supabase.from('reports').select('*').order('created_at', { ascending: false });

      const subsMap         = {};
      const reportsCountMap = {};
      const reportsDetailMap= {};

      (subsData || []).forEach((s) => { subsMap[s.user_id] = s.tier || 'free'; });
      (reportsData || []).forEach((r) => {
        reportsCountMap[r.reported_id]  = (reportsCountMap[r.reported_id]  || 0) + 1;
        if (!reportsDetailMap[r.reported_id]) reportsDetailMap[r.reported_id] = [];
        reportsDetailMap[r.reported_id].push(r);
      });

      const enriched = (profilesData || []).map((p) => ({
        ...p,
        tier:        subsMap[p.id]         || 'free',
        reportCount: reportsCountMap[p.id]  || 0,
        reports:     reportsDetailMap[p.id] || [],
        is_active:   p.is_active !== false,
      }));

      setProfiles(enriched);
      setStats({
        totalProfiles: enriched.length,
        totalReports:  (reportsData || []).length,
        totalActive:   enriched.filter((p) => p.is_active !== false).length,
        totalInactive: enriched.filter((p) => p.is_active === false).length,
      });
    } catch (err) {
      setDbError(err.message || 'Erreur de connexion');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadViaEdgeFunction = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-data`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) throw new Error(`Edge Function erreur: ${await res.text()}`);
      const { profiles: p, subscriptions: s, reports: r } = await res.json();
      const subsMap = {}; (s || []).forEach((sub) => { subsMap[sub.user_id] = sub.tier || 'free'; });
      const rcm = {}; const rdm = {};
      (r || []).forEach((rep) => { rcm[rep.reported_id] = (rcm[rep.reported_id] || 0) + 1; if (!rdm[rep.reported_id]) rdm[rep.reported_id] = []; rdm[rep.reported_id].push(rep); });
      const enriched = (p || []).map((prof) => ({ ...prof, tier: subsMap[prof.id] || 'free', reportCount: rcm[prof.id] || 0, reports: rdm[prof.id] || [], is_active: prof.is_active !== false }));
      setProfiles(enriched);
      setStats({ totalProfiles: enriched.length, totalReports: (r || []).length, totalActive: enriched.filter((x) => x.is_active !== false).length, totalInactive: enriched.filter((x) => x.is_active === false).length });
    } catch (err) {
      setDbError('RLS actif et Edge Function absente.\n\nExécutez le fichier admin_setup.sql dans Supabase pour activer l\'accès admin.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, []);

  const applyFilters = () => {
    let result = [...profiles];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.bio || '').toLowerCase().includes(q));
    }
    if (genderFilter !== 'ALL') result = result.filter((p) => p.gender === genderFilter);
    if (tierFilter   !== 'ALL') result = result.filter((p) => p.tier   === tierFilter);
    setFilteredProfiles(result);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleToggleActive = (profile) => {
    const newStatus  = !profile.is_active;
    const actionText = newStatus ? 'Activer' : 'Désactiver';
    Alert.alert(
      `${actionText} ce compte`,
      `Voulez-vous ${actionText.toLowerCase()} le compte de "${profile.full_name || 'cet utilisateur'}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionText, style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', profile.id);
              if (error) throw error;
              setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, is_active: newStatus } : p));
              setStats((prev) => ({
                ...prev,
                totalActive:   newStatus ? prev.totalActive   + 1 : prev.totalActive   - 1,
                totalInactive: newStatus ? prev.totalInactive - 1 : prev.totalInactive + 1,
              }));
              Alert.alert('✓ Succès', `Compte ${newStatus ? 'activé' : 'désactivé'} avec succès`);
            } catch (err) { Alert.alert('Erreur', err.message); }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = (profile) => {
    Alert.alert(
      '⚠️ Suppression définitive',
      `Supprimer le compte de "${profile.full_name || 'cet utilisateur'}" ?\n\nToutes ses données seront supprimées. Cette action est IRRÉVERSIBLE.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '🗑️ Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('notifications').delete().or(`user_id.eq.${profile.id},notifier_id.eq.${profile.id}`);
              await supabase.from('reports').delete().or(`reporter_id.eq.${profile.id},reported_id.eq.${profile.id}`);
              await supabase.from('messages').delete().or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
              await supabase.from('likes').delete().or(`liker_id.eq.${profile.id},liked_id.eq.${profile.id}`);
              await supabase.from('passes').delete().or(`passer_id.eq.${profile.id},passed_id.eq.${profile.id}`);
              await supabase.from('photos').delete().eq('user_id', profile.id);
              await supabase.from('subscriptions').delete().eq('user_id', profile.id);
              const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
              if (error) throw error;
              setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
              setStats((prev) => ({
                ...prev,
                totalProfiles: prev.totalProfiles - 1,
                totalActive:   profile.is_active !== false ? prev.totalActive   - 1 : prev.totalActive,
                totalInactive: profile.is_active === false ? prev.totalInactive - 1 : prev.totalInactive,
              }));
              Alert.alert('Supprimé', `Le compte a été supprimé définitivement.`);
            } catch (err) { Alert.alert('Erreur', err.message); }
          },
        },
      ]
    );
  };

  const handleViewReports = (profile) => {
    setSelectedReports(profile.reports || []);
    setSelectedReportUser(profile.full_name || 'Utilisateur');
    setReportModalVisible(true);
  };

  const handleAdminLogout = () => {
    Alert.alert('Quitter', "Voulez-vous quitter le panneau d'administration ?", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { adminLogout(); navigation.replace('Login'); } },
    ]);
  };

  // ── Composants ─────────────────────────────────────────────────────────────
  const StatBox = ({ value, label, color }) => (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const FilterBadge = ({ label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.filterBadge, active && styles.filterBadgeActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderProfileCard = (profile) => {
    const tierInfo = TIER_LABELS[profile.tier] || TIER_LABELS.free;
    const isActive = profile.is_active !== false;

    return (
      <TouchableOpacity
        key={profile.id}
        style={styles.profileCard}
        onPress={() => navigation.navigate('AdminProfileDetail', { profileId: profile.id })}
        activeOpacity={0.75}
      >
        {/* Avatar + Infos principales */}
        <View style={styles.profileHeader}>
          <Image
            source={profile.avatar_url ? { uri: profile.avatar_url } : require('../../assets/default-avatar.png')}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.full_name || '(sans nom)'}
            </Text>
            <View style={styles.badgesRow}>
              {/* Genre */}
              <View style={[styles.badge, { backgroundColor: profile.gender === 'MALE' ? 'rgba(59,130,246,0.1)' : 'rgba(241,62,147,0.1)' }]}>
                <Text style={[styles.badgeText, { color: profile.gender === 'MALE' ? '#3B82F6' : COLORS.primary }]}>
                  {profile.gender === 'MALE' ? '👨 Homme' : '👩 Femme'}
                </Text>
              </View>
              {/* Abonnement */}
              <View style={[styles.badge, { backgroundColor: tierInfo.bg }]}>
                <Text style={[styles.badgeText, { color: tierInfo.color }]}>{tierInfo.text}</Text>
              </View>
              {/* Statut */}
              <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                <Text style={[styles.badgeText, { color: isActive ? '#22C55E' : '#EF4444' }]}>
                  {isActive ? '🟢 Actif' : '🔴 Inactif'}
                </Text>
              </View>
            </View>
          </View>
          {/* Flèche navigation */}
          <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
        </View>

        {/* Ligne basse : signalements + boutons action */}
        <View style={styles.profileFooter}>
          {/* Signalements */}
          <TouchableOpacity
            style={[styles.reportInfo, profile.reportCount > 0 && styles.reportInfoDanger]}
            onPress={(e) => { e.stopPropagation?.(); profile.reportCount > 0 && handleViewReports(profile); }}
            disabled={profile.reportCount === 0}
          >
            <Ionicons name={profile.reportCount > 0 ? 'flag' : 'flag-outline'} size={13} color={profile.reportCount > 0 ? '#EF4444' : COLORS.gray} />
            <Text style={[styles.reportInfoText, profile.reportCount > 0 && { color: '#EF4444' }]}>
              {profile.reportCount} signalement{profile.reportCount !== 1 ? 's' : ''}
              {profile.reportCount > 0 ? ' ›' : ''}
            </Text>
          </TouchableOpacity>

          {/* Boutons */}
          <View style={styles.actionsRow}>
            {/* Toggle Actif/Inactif */}
            <TouchableOpacity
              style={[styles.actionBtn, isActive ? styles.actionBtnDisable : styles.actionBtnEnable]}
              onPress={(e) => { e.stopPropagation?.(); handleToggleActive(profile); }}
              activeOpacity={0.8}
            >
              <Ionicons name={isActive ? 'pause' : 'play'} size={13} color={COLORS.white} />
              <Text style={styles.actionBtnText}>{isActive ? 'Désact.' : 'Activer'}</Text>
            </TouchableOpacity>

            {/* Supprimer */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDelete]}
              onPress={(e) => { e.stopPropagation?.(); handleDeleteAccount(profile); }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={13} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Suppr.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── États spéciaux ─────────────────────────────────────────────────────────
  if (dbError) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={36} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Données inaccessibles</Text>
          <Text style={styles.errorText}>{dbError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadAllData()}>
            <Ionicons name="refresh" size={16} color={COLORS.white} />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du dashboard…</Text>
      </View>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Admin E-VADY</Text>
              <View style={styles.realtimePill}>
                <View style={styles.realtimeDot} />
                <Text style={styles.realtimeText}>Temps réel actif</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => loadAllData()}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.darkGray} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={handleAdminLogout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={stats.totalProfiles} label="Profils"      />
          <StatBox value={stats.totalActive}   label="Actifs"       color="#22C55E" />
          <StatBox value={stats.totalInactive} label="Inactifs"     color={COLORS.danger} />
          <StatBox value={stats.totalReports}  label="Signalements" color="#FF9500" />
        </View>
      </View>

      {/* ── Recherche + Filtres ─────────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
            placeholder="Rechercher par nom, bio…"
            placeholderTextColor={COLORS.gray}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={17} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <FilterBadge label="Tous"     active={genderFilter === 'ALL'}    onPress={() => setGenderFilter('ALL')}    />
            <FilterBadge label="👨 Homme" active={genderFilter === 'MALE'}   onPress={() => setGenderFilter('MALE')}   />
            <FilterBadge label="👩 Femme" active={genderFilter === 'FEMALE'} onPress={() => setGenderFilter('FEMALE')} />
            <View style={styles.filterSep} />
            <FilterBadge label="Tous plans" active={tierFilter === 'ALL'}     onPress={() => setTierFilter('ALL')}     />
            <FilterBadge label="Gratuit"    active={tierFilter === 'free'}    onPress={() => setTierFilter('free')}    />
            <FilterBadge label="Basic"      active={tierFilter === 'basic'}   onPress={() => setTierFilter('basic')}   />
            <FilterBadge label="Premium"    active={tierFilter === 'premium'} onPress={() => setTierFilter('premium')} />
            <FilterBadge label="VIP"        active={tierFilter === 'vip'}     onPress={() => setTierFilter('vip')}     />
          </View>
        </ScrollView>

        <Text style={styles.resultCount}>
          {filteredProfiles.length} profil{filteredProfiles.length !== 1 ? 's' : ''}
          {searchQuery || genderFilter !== 'ALL' || tierFilter !== 'ALL' ? ' filtré(s)' : ' au total'}
        </Text>
      </View>

      {/* ── Liste ─────────────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {filteredProfiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={52} color={COLORS.lightGray} />
            <Text style={styles.emptyTitle}>Aucun profil trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {profiles.length === 0
                ? 'La base de données est vide.\nExécutez admin_setup.sql dans Supabase si les données ne chargent pas.'
                : 'Modifiez votre recherche ou vos filtres.'}
            </Text>
          </View>
        ) : (
          filteredProfiles.map(renderProfileCard)
        )}
      </ScrollView>

      {/* ── Modal Signalements ──────────────────────────────────────────────── */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Signalements ({selectedReports.length})</Text>
                <Text style={styles.modalSubtitle}>Contre : {selectedReportUser}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.black} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
              {selectedReports.map((r, idx) => (
                <View key={r.id || idx} style={styles.reportItem}>
                  <View style={styles.reportItemHeader}>
                    <Ionicons name="flag" size={13} color={COLORS.danger} />
                    <Text style={styles.reportReason}>{r.reason || 'Raison non spécifiée'}</Text>
                  </View>
                  <Text style={styles.reportMeta}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' · Par : '}{r.reporter_id ? r.reporter_id.substring(0, 8) + '…' : '—'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.lightGray },
  center:      { justifyContent: 'center', alignItems: 'center', flex: 1 },
  loadingText: { color: COLORS.gray, marginTop: 10, fontSize: 14 },

  // ── Erreur ─────────────────────────────────────────────────────────────────
  errorBox: {
    alignItems: 'center', marginHorizontal: 24, padding: 24,
    backgroundColor: COLORS.white, borderRadius: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  errorTitle:    { fontSize: 17, fontWeight: '800', color: COLORS.black },
  errorText:     { fontSize: 13, color: COLORS.darkGray, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  retryBtnText:  { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  headerTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle:    { fontSize: 17, fontWeight: '900', color: COLORS.black },
  realtimePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  realtimeDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  realtimeText:   { fontSize: 10, color: COLORS.gray, fontWeight: '600' },
  headerActions:  { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnDanger:  { backgroundColor: 'rgba(255,68,68,0.08)' },

  // Stats
  statsRow:  { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  statLabel: { fontSize: 9, color: COLORS.gray, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Recherche ──────────────────────────────────────────────────────────────
  searchSection: {
    backgroundColor: COLORS.white, paddingHorizontal: 14,
    paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.lightGray, borderRadius: 12,
    paddingHorizontal: 12, gap: 8, marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.black },
  filterRow:   { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  filterSep:   { width: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 4 },
  filterBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  filterBadgeActive:     { backgroundColor: 'rgba(241,62,147,0.1)', borderColor: COLORS.primary },
  filterBadgeText:       { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  filterBadgeTextActive: { color: COLORS.primary, fontWeight: '700' },
  resultCount:           { fontSize: 11, color: COLORS.gray, marginTop: 6 },

  // ── Liste ──────────────────────────────────────────────────────────────────
  listContainer: { flex: 1 },
  listContent:   { padding: 14, paddingBottom: 50, gap: 10 },

  // Carte
  profileCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar:        { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.lightGray },
  profileInfo:   { flex: 1 },
  profileName:   { fontSize: 15, fontWeight: '700', color: COLORS.black, marginBottom: 6 },
  badgesRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeText:     { fontSize: 11, fontWeight: '700' },

  profileFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  reportInfo:     { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  reportInfoDanger:{},
  reportInfoText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  actionsRow:    { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  actionBtnText:   { fontSize: 11, fontWeight: '800', color: COLORS.white },
  actionBtnEnable: { backgroundColor: '#22C55E' },
  actionBtnDisable:{ backgroundColor: '#3B82F6' },
  actionBtnDelete: { backgroundColor: COLORS.danger },

  // ── Vide ───────────────────────────────────────────────────────────────────
  emptyState:    { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle:    { color: COLORS.darkGray, fontSize: 16, fontWeight: '700' },
  emptySubtitle: { color: COLORS.gray, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.black },
  modalSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center', alignItems: 'center',
  },
  reportItem: {
    padding: 12, borderRadius: 10, marginBottom: 8,
    backgroundColor: 'rgba(255,68,68,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.1)', gap: 4,
  },
  reportItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reportReason:     { fontSize: 13, fontWeight: '700', color: COLORS.black, flex: 1 },
  reportMeta:       { fontSize: 11, color: COLORS.gray },
});

export default AdminDashboardScreen;
