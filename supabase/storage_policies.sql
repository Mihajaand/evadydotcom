-- ================================================================
-- POLITIQUES RLS POUR LE STORAGE "photos" DE SUPABASE
-- Exécuter dans Supabase → SQL Editor
-- ================================================================
-- Ces règles permettent aux utilisateurs connectés d'uploader,
-- lire et supprimer leurs propres photos dans le bucket "photos".
-- ================================================================

-- 1. Lecture publique des photos (pour affichage dans l'app)
CREATE POLICY "Lecture publique des photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- 2. Upload de photos (utilisateurs connectés uniquement, dans leur dossier)
CREATE POLICY "Upload photo par utilisateur"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Suppression de ses propres photos
CREATE POLICY "Suppression de ses propres photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Mise à jour de ses propres photos (remplacement)
CREATE POLICY "Mise à jour de ses propres photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ================================================================
-- Vérification : lister les politiques du bucket photos
-- ================================================================
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
