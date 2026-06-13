-- ================================================================
-- CONFIGURATION SUPABASE POUR LE PANEL ADMIN E-VADY
-- Exécuter dans l'éditeur SQL de votre console Supabase
-- ================================================================

-- 1. Ajouter la colonne is_active si elle n'existe pas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Mettre tous les comptes existants à actif par défaut
UPDATE profiles SET is_active = true WHERE is_active IS NULL;

-- ================================================================
-- OPTION A (Recommandée pour le Panel Admin) :
-- Désactiver le RLS sur profiles pour permettre la lecture admin
-- ⚠️ Ne faire que si votre application gère la sécurité autrement
-- ================================================================

-- Désactiver RLS sur profiles (lecture publique admin)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- OPTION B (Plus sécurisée) :
-- Garder le RLS et ajouter une policy de lecture publique
-- ================================================================

-- Politique pour permettre la lecture de tous les profils (panel admin)
DROP POLICY IF EXISTS "Lecture admin publique" ON profiles;
CREATE POLICY "Lecture admin publique"
ON profiles FOR SELECT
TO anon, authenticated
USING (true);

-- Politique pour permettre la mise à jour du statut is_active
DROP POLICY IF EXISTS "Mise à jour admin profiles" ON profiles;
CREATE POLICY "Mise à jour admin profiles"
ON profiles FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Politique pour permettre la suppression (admin)
DROP POLICY IF EXISTS "Suppression admin profiles" ON profiles;
CREATE POLICY "Suppression admin profiles"
ON profiles FOR DELETE
TO anon, authenticated
USING (true);

-- ================================================================
-- Idem pour la table subscriptions (lecture admin)
-- ================================================================
DROP POLICY IF EXISTS "Lecture admin subscriptions" ON subscriptions;
CREATE POLICY "Lecture admin subscriptions"
ON subscriptions FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Suppression admin subscriptions" ON subscriptions;
CREATE POLICY "Suppression admin subscriptions"
ON subscriptions FOR DELETE
TO anon, authenticated
USING (true);

-- ================================================================
-- Idem pour la table reports (lecture admin)
-- ================================================================
DROP POLICY IF EXISTS "Lecture admin reports" ON reports;
CREATE POLICY "Lecture admin reports"
ON reports FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Suppression admin reports" ON reports;
CREATE POLICY "Suppression admin reports"
ON reports FOR DELETE
TO anon, authenticated
USING (true);

-- ================================================================
-- Activer le temps réel sur les tables importantes
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- Vérification : compter les profils
-- ================================================================
SELECT COUNT(*) as total_profiles FROM profiles;
SELECT COUNT(*) as total_subscriptions FROM subscriptions;
SELECT COUNT(*) as total_reports FROM reports;

-- ================================================================
-- Table pour stocker les paramètres globaux de l'application
-- ================================================================
CREATE TABLE IF NOT EXISTS app_settings (
	key text PRIMARY KEY,
	value text,
	description text,
	updated_at timestamptz DEFAULT now()
);

-- Insérer la clé de maintenance si absente
INSERT INTO app_settings (key, value, description)
VALUES ('maintenance_mode', 'false', 'Mode maintenance global pour l''application')
ON CONFLICT (key) DO NOTHING;

-- Politiques RLS minimales (adapter selon besoins de sécurité)
DROP POLICY IF EXISTS "public_read_app_settings" ON app_settings;
CREATE POLICY "public_read_app_settings"
ON app_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "public_update_app_settings" ON app_settings;
CREATE POLICY "public_update_app_settings"
ON app_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Activer le temps réel sur app_settings
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
NOTIFY pgrst, 'reload schema';
