-- apps/backend/supabase/migrations/20260506000000_wallet_transactions_gas_fields.sql
-- Add gas accounting columns for displaying gas burned on failed transactions.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS gas_used NUMERIC(78, 0),
  ADD COLUMN IF NOT EXISTS effective_gas_price NUMERIC(78, 0);

COMMENT ON COLUMN public.wallet_transactions.gas_used IS
  'Gas units consumed (from receipt). NULL for txs prior to 2026-05-06 or not yet receipted.';

COMMENT ON COLUMN public.wallet_transactions.effective_gas_price IS
  'Effective gas price in wei (from receipt). NULL for txs prior to 2026-05-06 or not yet receipted.';
