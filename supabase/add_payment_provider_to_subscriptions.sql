ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

NOTIFY pgrst, 'reload schema';
