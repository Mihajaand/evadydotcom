/**
 * Dashboard Admin E-VADY — Version corrigée
 * 
 * Correction principale : Le dashboard admin ne dépend PAS d'une session Supabase Auth.
 * Pour contourner le RLS, on appelle une Edge Function "admin-data" avec la clé anon
 * (qui est configurée pour bypasser le RLS côté serveur via service_role).
 * 
 * Si l'Edge Function n'existe pas encore, on utilise directement le client Supabase
 * avec la technique des .rpc() ou en passant par les requêtes directes.
 * 
 * SOLUTION DE FALLBACK ROBUSTE :
 * - On tente d'abord via .select() normal (si RLS est permissif ou désactivé sur profiles)
 * - Si ça échoue, on log l'erreur et on affiche un message clair
 * - L'abonnement temps réel écoute les changements sur profiles et subscriptions
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Labels d'abonnement
const TIER_LABELS = {
  free:    { text: 'Gratuit', color: '#999',    bg: 'rgba(153,153,153,0.15)' },
  basic:   { text: 'Basic',   color: '#5DD3B6', bg: 'rgba(93,211,182,0.15)'  },
  premium: { text: 'Premium', color: '#F13E93', bg: 'rgba(241,62,147,0.15)'  },
  vip:     { text: 'VIP',     color: '#FFD700', bg: 'rgba(255,215,0,0.15)'   },
};

const AdminDashboardScreen = ({ navigation }) => {
  const { isAdminLoggedIn, adminLogout } = useAdminStore();

  const [profiles, setProfiles]               = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [dbError, setDbError]                 = useState(null);

  const [searchQuery,  setSearchQuery]  = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [tierFilter,   setTierFilter]   = useState('ALL');

  const [reportModalVisible,  setReportModalVisible]  = useState(false);
  const [selectedReports,     setSelectedReports]     = useState([]);
  const [selectedReportUser,  setSelectedReportUser]  = useState('');

  const [stats, setStats] = useState({
    totalProfiles: 0,
    totalReports:  0,
    totalActive:   0,
    totalInactive: 0,
  });

  // Abonnements temps réel
  const realtimeRef = useRef(null);

  // Garder la session admin
  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigation.replace('Login');
    }
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadAllData();
      setupRealtime();
    }
    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, [isAdminLoggedIn]);

  useEffect(() => {
    applyFilters();
  }, [profiles, searchQuery, genderFilter, tierFilter]);

  /**
   * Abonnement temps réel sur les changements de profiles et subscriptions
   */
  const setupRealtime = () => {
    const channel = supabase
      .channel('admin-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          loadAllData(true); // rechargement silencieux
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => {
          loadAllData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          loadAllData(true);
        }
      )
      .subscribe();

    realtimeRef.current = channel;
  };

  /**
   * Charge toutes les données admin via les appels Supabase directs.
   * Si le RLS bloque, on tente via l'Edge Function admin-data.
   */
  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    setDbError(null);

    try {
      // ─── 1. Profils ───────────────────────────────────────────────────────
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Erreur profiles:', profilesError);
        // Fallback : tenter via Edge Function
        await loadViaEdgeFunction(silent);
        return;
      }

      // ─── 2. Abonnements ───────────────────────────────────────────────────
      const { data: subscriptionsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id, tier');

      if (subsError) {
        console.warn('Erreur subscriptions (ignorée):', subsError.message);
      }

      // ─── 3. Signalements ──────────────────────────────────────────────────
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) {
        console.warn('Erreur reports (ignorée):', reportsError.message);
      }

      // ─── Fusion des données ───────────────────────────────────────────────
      const subsMap = {};
      (subscriptionsData || []).forEach((s) => {
        subsMap[s.user_id] = s.tier || 'free';
      });

      const reportsCountMap  = {};
      const reportsDetailMap = {};
      (reportsData || []).forEach((r) => {
        reportsCountMap[r.reported_id]  = (reportsCountMap[r.reported_id]  || 0) + 1;
        if (!reportsDetailMap[r.reported_id]) reportsDetailMap[r.reported_id] = [];
        reportsDetailMap[r.reported_id].push(r);
      });

      const enriched = (profilesData || []).map((p) => ({
        ...p,
        tier:        subsMap[p.id] || 'free',
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
      console.error('Erreur globale loadAllData:', err);
      setDbError(err.message || 'Erreur de connexion à la base de données');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /**
   * Fallback via Edge Function "admin-data" (utilise service_role côté serveur)
   * Crée cette fonction dans Supabase si le RLS bloque les requêtes directes.
   */
  const loadViaEdgeFunction = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Edge Function introuvable ou erreur: ${errText}`);
      }

      const { profiles: p, subscriptions: s, reports: r } = await response.json();

      const subsMap = {};
      (s || []).forEach((sub) => { subsMap[sub.user_id] = sub.tier || 'free'; });

      const reportsCountMap  = {};
      const reportsDetailMap = {};
      (r || []).forEach((rep) => {
        reportsCountMap[rep.reported_id]  = (reportsCountMap[rep.reported_id]  || 0) + 1;
        if (!reportsDetailMap[rep.reported_id]) reportsDetailMap[rep.reported_id] = [];
        reportsDetailMap[rep.reported_id].push(rep);
      });

      const enriched = (p || []).map((prof) => ({
        ...prof,
        tier:        subsMap[prof.id] || 'free',
        reportCount: reportsCountMap[prof.id]  || 0,
        reports:     reportsDetailMap[prof.id] || [],
        is_active:   prof.is_active !== false,
      }));

      setProfiles(enriched);
      setStats({
        totalProfiles: enriched.length,
        totalReports:  (r || []).length,
        totalActive:   enriched.filter((x) => x.is_active !== false).length,
        totalInactive: enriched.filter((x) => x.is_active === false).length,
      });

    } catch (err) {
      console.error('Edge Function échouée:', err);
      setDbError(
        '⚠️ RLS actif et Edge Function absente.\n\n' +
        'Solution :\n' +
        '1. Désactiver RLS sur "profiles" dans Supabase\n' +
        '   OU\n' +
        '2. Créer l\'Edge Function "admin-data"'
      );
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
      result = result.filter(
        (p) =>
          (p.full_name   || '').toLowerCase().includes(q) ||
          (p.email       || '').toLowerCase().includes(q) ||
          (p.bio         || '').toLowerCase().includes(q)
      );
    }

    if (genderFilter !== 'ALL') {
      result = result.filter((p) => p.gender === genderFilter);
    }

    if (tierFilter !== 'ALL') {
      result = result.filter((p) => p.tier === tierFilter);
    }

    setFilteredProfiles(result);
  };

  /**
   * Toggle actif / inactif
   */
  const handleToggleActive = (profile) => {
    const newStatus  = !profile.is_active;
    const actionText = newStatus ? 'Activer' : 'Désactiver';

    Alert.alert(
      `${actionText} le compte`,
      `Voulez-vous ${actionText.toLowerCase()} le compte de "${profile.full_name || 'cet utilisateur'}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionText,
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', profile.id);

              if (error) throw error;

              // Mise à jour locale immédiate (avant que le realtime revienne)
              setProfiles((prev) =>
                prev.map((p) =>
                  p.id === profile.id ? { ...p, is_active: newStatus } : p
                )
              );
              setStats((prev) => ({
                ...prev,
                totalActive:   newStatus ? prev.totalActive   + 1 : prev.totalActive   - 1,
                totalInactive: newStatus ? prev.totalInactive - 1 : prev.totalInactive + 1,
              }));

              Alert.alert(
                'Succès',
                `Compte "${profile.full_name || ''}" ${newStatus ? 'activé' : 'désactivé'} ✓`
              );
            } catch (err) {
              console.error('Erreur toggle:', err);
              Alert.alert('Erreur', err.message || 'Impossible de modifier le statut');
            }
          },
        },
      ]
    );
  };

  /**
   * Suppression définitive
   */
  const handleDeleteAccount = (profile) => {
    Alert.alert(
      '⚠️ Suppression définitive',
      `ATTENTION : Supprimer le compte de "${profile.full_name || 'cet utilisateur'}" ?\n\nToutes ses données (messages, photos, matchs, signalements) seront supprimées. Cette action est IRRÉVERSIBLE.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '🗑️ SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            try {
              // Suppression dans l'ordre pour respecter les FK
              await supabase.from('notifications').delete()
                .or(`user_id.eq.${profile.id},notifier_id.eq.${profile.id}`);
              await supabase.from('reports').delete()
                .or(`reporter_id.eq.${profile.id},reported_id.eq.${profile.id}`);
              await supabase.from('messages').delete()
                .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
              await supabase.from('likes').delete()
                .or(`liker_id.eq.${profile.id},liked_id.eq.${profile.id}`);
              await supabase.from('passes').delete()
                .or(`passer_id.eq.${profile.id},passed_id.eq.${profile.id}`);
              await supabase.from('photos').delete().eq('user_id', profile.id);
              await supabase.from('subscriptions').delete().eq('user_id', profile.id);

              const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
              if (error) throw error;

              // Suppression locale immédiate
              setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
              setStats((prev) => ({
                ...prev,
                totalProfiles: prev.totalProfiles - 1,
                totalActive:   profile.is_active !== false ? prev.totalActive   - 1 : prev.totalActive,
                totalInactive: profile.is_active === false ? prev.totalInactive - 1 : prev.totalInactive,
              }));

              Alert.alert('Supprimé', `Le compte "${profile.full_name || ''}" a été supprimé.`);
            } catch (err) {
              console.error('Erreur suppression:', err);
              Alert.alert('Erreur', err.message || 'Impossible de supprimer le compte');
            }
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
    Alert.alert(
      'Quitter',
      "Voulez-vous quitter le panneau d'administration ?",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            adminLogout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  // ─── Sous-composants ───────────────────────────────────────────────────────

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
      <View key={profile.id} style={styles.profileCard}>
        {/* Avatar + Infos */}
        <View style={styles.profileHeader}>
          <Image
            source={
              profile.avatar_url
                ? { uri: profile.avatar_url }
                : require('../../assets/default-avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.full_name || '(sans nom)'}
            </Text>

            {/* Identifiant court */}
            <Text style={styles.profileId} numberOfLines={1}>
              ID : {profile.id ? profile.id.substring(0, 12) + '…' : '—'}
            </Text>

            {/* Badges */}
            <View style={styles.badgesRow}>
              {/* Genre */}
              <View style={[
                styles.badge,
                { backgroundColor: profile.gender === 'MALE'
                  ? 'rgba(59,130,246,0.15)'
                  : 'rgba(236,72,153,0.15)' }
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: profile.gender === 'MALE' ? '#3B82F6' : '#EC4899' }
                ]}>
                  {profile.gender === 'MALE' ? '👨 Homme' : '👩 Femme'}
                </Text>
              </View>

              {/* Abonnement */}
              <View style={[styles.badge, { backgroundColor: tierInfo.bg }]}>
                <Text style={[styles.badgeText, { color: tierInfo.color }]}>
                  ★ {tierInfo.text}
                </Text>
              </View>

              {/* Statut */}
              <View style={[
                styles.badge,
                { backgroundColor: isActive
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)' }
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: isActive ? '#22C55E' : '#EF4444' }
                ]}>
                  {isActive ? '🟢 Actif' : '🔴 Inactif'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer : signalements + actions */}
        <View style={styles.profileFooter}>
          <TouchableOpacity
            style={[
              styles.reportInfo,
              profile.reportCount > 0 && styles.reportInfoDanger,
            ]}
            onPress={() => profile.reportCount > 0 && handleViewReports(profile)}
            disabled={profile.reportCount === 0}
          >
            <Ionicons
              name={profile.reportCount > 0 ? 'flag' : 'flag-outline'}
              size={14}
              color={profile.reportCount > 0 ? '#EF4444' : '#555'}
            />
            <Text style={[
              styles.reportInfoText,
              profile.reportCount > 0 && styles.reportInfoTextDanger,
            ]}>
              {profile.reportCount} signalement{profile.reportCount !== 1 ? 's' : ''}
              {profile.reportCount > 0 ? ' — voir ›' : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            {/* Bouton O — Toggle */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isActive ? styles.actionBtnDisable : styles.actionBtnEnable,
              ]}
              onPress={() => handleToggleActive(profile)}
              activeOpacity={0.75}
            >
              <View style={styles.actionBtnInner}>
                <Ionicons
                  name={isActive ? 'pause-circle' : 'play-circle'}
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.actionBtnLabel}>
                  {isActive ? 'Désact.' : 'Activer'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Bouton X — Supprimer */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDelete]}
              onPress={() => handleDeleteAccount(profile)}
              activeOpacity={0.75}
            >
              <View style={styles.actionBtnInner}>
                <Ionicons name="trash" size={18} color="#FFF" />
                <Text style={styles.actionBtnLabel}>Suppr.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── Écran d'erreur RLS ────────────────────────────────────────────────────
  if (dbError) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.errorBox}>
          <Ionicons name="warning" size={40} color="#FF6B35" />
          <Text style={styles.errorTitle}>Accès aux données impossible</Text>
          <Text style={styles.errorText}>{dbError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadAllData()}>
            <Ionicons name="refresh" size={16} color="#FFF" />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Écran de chargement ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FF3B3B" />
        <Text style={styles.loadingText}>Chargement des données admin…</Text>
      </View>
    );
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={22} color="#FF3B3B" />
            <Text style={styles.headerTitle}>Admin E-VADY</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadAllData()}
            >
              <Ionicons name="refresh" size={18} color="#AAA" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleAdminLogout}
            >
              <Ionicons name="log-out-outline" size={18} color="#FF3B3B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats en temps réel */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalProfiles}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>
              {stats.totalActive}
            </Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {stats.totalInactive}
            </Text>
            <Text style={styles.statLabel}>Inactifs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#FF6B35' }]}>
              {stats.totalReports}
            </Text>
            <Text style={styles.statLabel}>Signalements</Text>
          </View>
        </View>
      </View>

      {/* ── Recherche + Filtres ─────────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#666" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Nom, bio…"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={17} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtre genre */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            <FilterBadge label="Tous" active={genderFilter === 'ALL'} onPress={() => setGenderFilter('ALL')} />
            <FilterBadge label="👨 Homme"  active={genderFilter === 'MALE'}   onPress={() => setGenderFilter('MALE')}   />
            <FilterBadge label="👩 Femme"  active={genderFilter === 'FEMALE'} onPress={() => setGenderFilter('FEMALE')} />
            <View style={styles.filterSep} />
            <FilterBadge label="Tous abonnements" active={tierFilter === 'ALL'}     onPress={() => setTierFilter('ALL')}     />
            <FilterBadge label="Gratuit" active={tierFilter === 'free'}    onPress={() => setTierFilter('free')}    />
            <FilterBadge label="Basic"   active={tierFilter === 'basic'}   onPress={() => setTierFilter('basic')}   />
            <FilterBadge label="Premium" active={tierFilter === 'premium'} onPress={() => setTierFilter('premium')} />
            <FilterBadge label="VIP ★"   active={tierFilter === 'vip'}    onPress={() => setTierFilter('vip')}     />
          </View>
        </ScrollView>

        <Text style={styles.resultCount}>
          {filteredProfiles.length} profil{filteredProfiles.length !== 1 ? 's' : ''}
          {(searchQuery || genderFilter !== 'ALL' || tierFilter !== 'ALL') ? ' trouvé(s)' : ''}
          {' '}· Temps réel actif 🟢
        </Text>
      </View>

      {/* ── Liste des profils ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF3B3B"
            colors={['#FF3B3B']}
          />
        }
      >
        {filteredProfiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={50} color="#333" />
            <Text style={styles.emptyTitle}>Aucun profil trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {profiles.length === 0
                ? 'La base de données est vide ou le RLS bloque les requêtes.\nTirez vers le bas pour rafraîchir.'
                : 'Essayez des termes de recherche différents.'}
            </Text>
          </View>
        ) : (
          filteredProfiles.map(renderProfileCard)
        )}
      </ScrollView>

      {/* ── Modal Signalements ──────────────────────────────────────────────── */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Signalements ({selectedReports.length})
                </Text>
                <Text style={styles.modalSubtitle}>
                  Contre : {selectedReportUser}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setReportModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.reportsList}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {selectedReports.length === 0 ? (
                <Text style={styles.noReportsText}>Aucun signalement enregistré</Text>
              ) : (
                selectedReports.map((report, idx) => (
                  <View key={report.id || idx} style={styles.reportItem}>
                    <View style={styles.reportItemHeader}>
                      <Ionicons name="flag" size={14} color="#EF4444" />
                      <Text style={styles.reportReason}>
                        {report.reason || 'Raison non spécifiée'}
                      </Text>
                    </View>
                    <Text style={styles.reportDate}>
                      📅 {report.created_at
                        ? new Date(report.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : 'Date inconnue'}
                    </Text>
                    <Text style={styles.reportReporter}>
                      Par : {report.reporter_id
                        ? report.reporter_id.substring(0, 8) + '…'
                        : 'Anonyme'}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0D0D0D' },
  center:      { justifyContent: 'center', alignItems: 'center', flex: 1 },
  loadingText: { color: '#666', marginTop: 12, fontSize: 14 },

  // ── Erreur ────────────────────────────────────────────────────────────────
  errorBox: {
    alignItems: 'center',
    marginHorizontal: 24,
    padding: 24,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    gap: 12,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#FF6B35', textAlign: 'center' },
  errorText:  { fontSize: 13, color: '#888',    textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF3B3B', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: '#111',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:     { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  headerActions:   { flexDirection: 'row', gap: 8 },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoutBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,59,59,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 6 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statLabel: {
    fontSize: 9, color: '#666', fontWeight: '700', marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── Recherche + Filtres ───────────────────────────────────────────────────
  searchSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 12, gap: 8, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#FFF' },
  filterScroll: { marginBottom: 6 },
  filterRow:   { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  filterSep:   { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  filterBadge: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filterBadgeActive:     { backgroundColor: 'rgba(255,59,59,0.15)', borderColor: '#FF3B3B' },
  filterBadgeText:       { fontSize: 12, fontWeight: '600', color: '#777' },
  filterBadgeTextActive: { color: '#FF3B3B' },
  resultCount:           { fontSize: 11, color: '#444', marginTop: 2 },

  // ── Liste ─────────────────────────────────────────────────────────────────
  listContainer: { flex: 1 },
  listContent:   { padding: 14, paddingBottom: 50, gap: 10 },

  // ── Carte profil ──────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: '#181818',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  profileHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2A2A2A' },
  profileInfo:   { flex: 1 },
  profileName:   { fontSize: 15, fontWeight: '700', color: '#FFF' },
  profileId:     { fontSize: 10, color: '#555', marginTop: 2 },
  badgesRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  badge:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  badgeText:     { fontSize: 11, fontWeight: '700' },

  // Footer
  profileFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  reportInfo:         { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  reportInfoDanger:   { },
  reportInfoText:     { fontSize: 11, color: '#555', fontWeight: '600' },
  reportInfoTextDanger: { color: '#EF4444' },

  actionsRow: { flexDirection: 'row', gap: 7 },
  actionBtn: {
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnInner:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionBtnLabel:  { fontSize: 11, fontWeight: '800', color: '#FFF' },
  actionBtnEnable: { backgroundColor: '#22C55E' },
  actionBtnDisable:{ backgroundColor: '#3B82F6' },
  actionBtnDelete: { backgroundColor: '#EF4444' },

  // ── État vide ─────────────────────────────────────────────────────────────
  emptyState:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:    { color: '#444', fontSize: 16, fontWeight: '700' },
  emptySubtitle: { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // ── Modal signalements ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '72%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: '#FFF' },
  modalSubtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  reportsList:     { paddingHorizontal: 18, paddingTop: 12 },
  noReportsText:   { color: '#444', fontSize: 14, textAlign: 'center', paddingVertical: 30 },
  reportItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)',
    gap: 4,
  },
  reportItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reportReason:     { fontSize: 14, fontWeight: '700', color: '#FFF', flex: 1 },
  reportDate:       { fontSize: 11, color: '#555' },
  reportReporter:   { fontSize: 11, color: '#444' },
});

export default AdminDashboardScreen;
