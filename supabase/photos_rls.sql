-- ================================================================
-- POLITIQUES RLS POUR LA TABLE "photos"
-- Exécuter dans Supabase → SQL Editor
-- ================================================================
-- Par défaut, le RLS sur la table "photos" n'autorise que chaque
-- utilisateur à lire SES propres photos.
-- Ces politiques permettent à TOUS les utilisateurs connectés
-- (incluant la session admin) de lire les photos de n'importe quel profil.
-- ================================================================

-- 1. Supprimer les anciennes politiques restrictives si elles existent
DROP POLICY IF EXISTS "Lecture de ses propres photos" ON photos;
DROP POLICY IF EXISTS "Lecture photos utilisateur" ON photos;
DROP POLICY IF EXISTS "Select own photos" ON photos;

-- 2. Politique de LECTURE : tous les utilisateurs connectés peuvent
--    lire TOUTES les photos (nécessaire pour l'admin et pour voir
--    les photos des autres profils dans l'app)
CREATE POLICY "Lecture publique des photos"
ON photos FOR SELECT
TO authenticated
USING (true);

-- Ou si vous voulez autoriser aussi les utilisateurs non connectés (anon) :
-- CREATE POLICY "Lecture publique des photos"
-- ON photos FOR SELECT
-- TO public
-- USING (true);

-- 3. Politique d'INSERT : chaque utilisateur ne peut ajouter
--    que ses propres photos
DROP POLICY IF EXISTS "Insert propres photos" ON photos;
CREATE POLICY "Insert propres photos"
ON photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Politique d'UPDATE : chaque utilisateur ne peut modifier
--    que ses propres photos
DROP POLICY IF EXISTS "Update propres photos" ON photos;
CREATE POLICY "Update propres photos"
ON photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Politique de DELETE : chaque utilisateur ne peut supprimer
--    que ses propres photos
DROP POLICY IF EXISTS "Delete propres photos" ON photos;
CREATE POLICY "Delete propres photos"
ON photos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ================================================================
-- Vérification : doit lister les 4 politiques créées
-- ================================================================
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'photos';

-- ================================================================
-- Test rapide : compter toutes les photos (doit retourner un nombre > 0)
-- ================================================================
SELECT COUNT(*) as total_photos FROM photos;
