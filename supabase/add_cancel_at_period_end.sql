-- Ajouter la colonne cancel_at_period_end à la table subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Mettre à jour le cache PostgREST
NOTIFY pgrst, 'reload schema';
