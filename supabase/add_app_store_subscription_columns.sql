ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_apple_original_transaction_id_key
  ON subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
