-- ================================================================
-- CONFIGURATION DE LA TABLE LIKES ET DES RÈGLES RLS
-- À exécuter dans l'éditeur SQL de votre console Supabase
-- ================================================================

-- 1. Activer la sécurité RLS (Row Level Security) sur la table likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 2. Politique : Lecture des likes pour les utilisateurs connectés
DROP POLICY IF EXISTS "Lecture des likes par les utilisateurs authentifiés" ON likes;
CREATE POLICY "Lecture des likes par les utilisateurs authentifiés"
ON likes FOR SELECT
TO authenticated
USING (true);

-- 3. Politique : Insertion par l'utilisateur connecté de ses propres likes
DROP POLICY IF EXISTS "Insertion de ses propres likes" ON likes;
CREATE POLICY "Insertion de ses propres likes"
ON likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = liker_id);

-- 4. Politique : Suppression de ses propres likes
DROP POLICY IF EXISTS "Suppression de ses propres likes" ON likes;
CREATE POLICY "Suppression de ses propres likes"
ON likes FOR DELETE
TO authenticated
USING (auth.uid() = liker_id);

-- 5. Activer le temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
NOTIFY pgrst, 'reload schema';
