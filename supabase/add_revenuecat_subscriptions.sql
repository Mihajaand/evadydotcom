ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_product_id TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_original_transaction_id TEXT;

NOTIFY pgrst, 'reload schema';
