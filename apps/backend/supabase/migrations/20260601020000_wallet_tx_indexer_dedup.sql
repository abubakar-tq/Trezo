-- Indexer idempotency: an incoming on-chain transfer is uniquely identified by
-- (chain_id, transaction_hash, log_index). Native transfers use log_index = -1.
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS log_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_indexer_dedup_idx
  ON public.wallet_transactions (chain_id, transaction_hash, log_index)
  WHERE direction = 'incoming' AND transaction_hash IS NOT NULL AND log_index IS NOT NULL;
