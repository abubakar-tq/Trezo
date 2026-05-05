-- account_security_events: written exclusively by the sync worker (service role).
-- Rows mirror indexer_v1.account_security_event with security-event detail.
-- RLS: users can SELECT their own wallet's events; no INSERT/UPDATE from client.

CREATE TABLE IF NOT EXISTS public.account_security_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id   UUID REFERENCES public.aa_wallets(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  chain_id       INTEGER NOT NULL,
  event_type     TEXT NOT NULL,
  event_data     JSONB,
  tx_hash        TEXT NOT NULL,
  log_index      INTEGER NOT NULL,
  block_number   BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_security_events_chain_tx_log_idx
  ON public.account_security_events(chain_id, tx_hash, log_index);

CREATE INDEX IF NOT EXISTS account_security_events_wallet_idx
  ON public.account_security_events(wallet_address);

CREATE INDEX IF NOT EXISTS account_security_events_user_created_idx
  ON public.account_security_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_security_events_wallet_id_idx
  ON public.account_security_events(aa_wallet_id)
  WHERE aa_wallet_id IS NOT NULL;

ALTER TABLE public.account_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ase_select_own" ON public.account_security_events;
CREATE POLICY "ase_select_own"
  ON public.account_security_events FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.aa_wallets w
      WHERE w.id = account_security_events.aa_wallet_id
        AND w.user_id = auth.uid()
    )
  );
-- No INSERT/UPDATE/DELETE policies: only service role writes these rows.
