-- Migration: add network_key to aa_wallets and wallet_transactions
-- Run: supabase db push  (or apply manually via Supabase dashboard)

-- ─── aa_wallets ───────────────────────────────────────────────────────────────

ALTER TABLE public.aa_wallets
  ADD COLUMN IF NOT EXISTS network_key TEXT;

-- Back-fill existing rows from their chain_id
UPDATE public.aa_wallets
SET network_key = CASE
  WHEN chain_id = 31337   THEN 'anvil-local'
  WHEN chain_id = 11155111 THEN 'ethereum-sepolia'
  WHEN chain_id = 8453    THEN 'base-mainnet-fork'
  ELSE 'chain-' || chain_id::text
END
WHERE network_key IS NULL;

ALTER TABLE public.aa_wallets
  ALTER COLUMN network_key SET NOT NULL;

-- Drop old unique constraints that block multi-network rows
ALTER TABLE public.aa_wallets
  DROP CONSTRAINT IF EXISTS aa_wallets_user_chain_unique;

DROP INDEX IF EXISTS aa_wallets_wallet_identity_chain_idx;

-- New unique index: one wallet per user per network (with optional identity)
CREATE UNIQUE INDEX IF NOT EXISTS aa_wallets_user_wallet_network_idx
  ON public.aa_wallets(user_id, wallet_identity, wallet_index, network_key)
  WHERE wallet_identity IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS aa_wallets_user_network_idx
  ON public.aa_wallets(user_id, network_key);

-- Relax the global predicted_address uniqueness so same address can exist on
-- different networks (e.g., base-mainnet-fork and base-mainnet).
ALTER TABLE public.aa_wallets
  DROP CONSTRAINT IF EXISTS aa_wallets_predicted_address_key;

CREATE INDEX IF NOT EXISTS aa_wallets_predicted_address_idx
  ON public.aa_wallets(predicted_address);

CREATE UNIQUE INDEX IF NOT EXISTS aa_wallets_user_network_address_unique
  ON public.aa_wallets(user_id, network_key, lower(predicted_address));

-- ─── wallet_transactions ──────────────────────────────────────────────────────

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS network_key TEXT;

-- Back-fill
UPDATE public.wallet_transactions
SET network_key = CASE
  WHEN chain_id = 31337    THEN 'anvil-local'
  WHEN chain_id = 11155111 THEN 'ethereum-sepolia'
  WHEN chain_id = 8453     THEN 'base-mainnet-fork'
  ELSE 'chain-' || chain_id::text
END
WHERE network_key IS NULL;

ALTER TABLE public.wallet_transactions
  ALTER COLUMN network_key SET NOT NULL;

-- Index for history queries scoped by network
CREATE INDEX IF NOT EXISTS wallet_transactions_address_network_created_idx
  ON public.wallet_transactions(wallet_address, network_key, created_at DESC);
