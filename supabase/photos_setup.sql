-- ================================================================
-- CONFIGURATION DE LA TABLE PHOTOS ET DES RÈGLES RLS
-- À exécuter dans l'éditeur SQL de votre console Supabase
-- ================================================================

-- 1. Création de la table photos si elle n'existe pas
CREATE TABLE IF NOT EXISTS photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_profile boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Activer la sécurité RLS (Row Level Security)
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 3. Politiques RLS pour la table photos

-- Politique A : Lecture publique des photos pour tous les utilisateurs connectés
DROP POLICY IF EXISTS "Lecture publique des photos" ON photos;
CREATE POLICY "Lecture publique des photos"
ON photos FOR SELECT
TO authenticated
USING (true);

-- Politique B : Insertion par l'utilisateur connecté de ses propres photos
DROP POLICY IF EXISTS "Insertion de ses propres photos" ON photos;
CREATE POLICY "Insertion de ses propres photos"
ON photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Politique C : Mise à jour par l'utilisateur de ses propres photos
DROP POLICY IF EXISTS "Mise à jour de ses propres photos" ON photos;
CREATE POLICY "Mise à jour de ses propres photos"
ON photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Politique D : Suppression par l'utilisateur de ses propres photos
DROP POLICY IF EXISTS "Suppression de ses propres photos" ON photos;
CREATE POLICY "Suppression de ses propres photos"
ON photos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Activer le temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
NOTIFY pgrst, 'reload schema';
