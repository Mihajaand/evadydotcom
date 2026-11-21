ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_deletion_requested_at TIMESTAMPTZ;
