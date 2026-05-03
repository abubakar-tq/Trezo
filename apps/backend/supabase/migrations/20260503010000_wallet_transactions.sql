-- Send domain transaction lifecycle table.
-- Keeps full pre-sign -> receipt lifecycle without overloading aa_transactions.

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID REFERENCES public.aa_wallets(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('send_native','send_erc20','swap','bridge','contract_interaction')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','prepared','signing','signed','submitted','pending','confirmed','failed','cancelled','dropped')),
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming','outgoing','self')),
  token_type TEXT NOT NULL CHECK (token_type IN ('native','erc20')),
  token_address TEXT,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  amount_display TEXT NOT NULL,
  target_address TEXT NOT NULL,
  value_raw TEXT NOT NULL DEFAULT '0',
  calldata TEXT NOT NULL DEFAULT '0x',
  user_op_hash TEXT,
  transaction_hash TEXT,
  block_number BIGINT,
  entry_point TEXT,
  bundler_url TEXT,
  paymaster_used BOOLEAN DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  debug_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx
  ON public.wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_created_idx
  ON public.wallet_transactions(aa_wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_address_chain_created_idx
  ON public.wallet_transactions(wallet_address, chain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_op_hash_idx
  ON public.wallet_transactions(user_op_hash)
  WHERE user_op_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_transactions_transaction_hash_idx
  ON public.wallet_transactions(transaction_hash)
  WHERE transaction_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_transactions_status_idx
  ON public.wallet_transactions(status);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_select_own"
  ON public.wallet_transactions FOR SELECT
  USING (
    auth.uid() = user_id
    AND (
      aa_wallet_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.aa_wallets w
        WHERE w.id = wallet_transactions.aa_wallet_id
          AND w.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "wallet_transactions_insert_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_insert_own"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      aa_wallet_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.aa_wallets w
        WHERE w.id = wallet_transactions.aa_wallet_id
          AND w.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "wallet_transactions_update_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_update_own"
  ON public.wallet_transactions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (
      aa_wallet_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.aa_wallets w
        WHERE w.id = wallet_transactions.aa_wallet_id
          AND w.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      aa_wallet_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.aa_wallets w
        WHERE w.id = wallet_transactions.aa_wallet_id
          AND w.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "wallet_transactions_delete_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_delete_own"
  ON public.wallet_transactions FOR DELETE
  USING (
    auth.uid() = user_id
    AND (
      aa_wallet_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.aa_wallets w
        WHERE w.id = wallet_transactions.aa_wallet_id
          AND w.user_id = auth.uid()
      )
    )
  );

DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON public.wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
