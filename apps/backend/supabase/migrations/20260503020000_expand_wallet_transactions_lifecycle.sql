ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS fee_mode TEXT,
  ADD COLUMN IF NOT EXISTS intent_id UUID,
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_index INTEGER,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

ALTER TABLE public.wallet_transactions
  ALTER COLUMN token_type DROP NOT NULL,
  ALTER COLUMN token_symbol DROP NOT NULL,
  ALTER COLUMN token_decimals DROP NOT NULL,
  ALTER COLUMN from_address DROP NOT NULL,
  ALTER COLUMN to_address DROP NOT NULL,
  ALTER COLUMN amount_raw DROP NOT NULL,
  ALTER COLUMN amount_display DROP NOT NULL,
  ALTER COLUMN target_address DROP NOT NULL,
  ALTER COLUMN value_raw DROP NOT NULL,
  ALTER COLUMN calldata DROP NOT NULL;

ALTER TABLE public.wallet_transactions
  ALTER COLUMN value_raw SET DEFAULT '0',
  ALTER COLUMN calldata SET DEFAULT '0x';

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_status_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_token_type_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_v2_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_status_v2_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_token_type_v2_check;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_fee_mode_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_v2_check
  CHECK (type IN (
    'send_native',
    'send_erc20',
    'token_approval',
    'swap',
    'bridge',
    'cross_chain_swap',
    'module_install',
    'recovery',
    'contract_interaction'
  ));

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_status_v2_check
  CHECK (status IN (
    'draft',
    'prepared',
    'signing',
    'signed',
    'submitted',
    'pending',
    'confirmed',
    'failed',
    'cancelled',
    'dropped'
  ));

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_token_type_v2_check
  CHECK (token_type IS NULL OR token_type IN ('native','erc20'));

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_fee_mode_check
  CHECK (fee_mode IS NULL OR fee_mode IN ('sponsored','wallet_native','token_paymaster','unknown'));

CREATE INDEX IF NOT EXISTS wallet_transactions_user_status_idx
  ON public.wallet_transactions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_parent_idx
  ON public.wallet_transactions(parent_transaction_id, sequence_index);

CREATE INDEX IF NOT EXISTS wallet_transactions_intent_idx
  ON public.wallet_transactions(intent_id);
