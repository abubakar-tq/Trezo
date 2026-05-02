-- Level 2 guardian recovery metadata.
-- UX-only: the SocialRecovery contract remains the authority.

CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID NOT NULL REFERENCES public.aa_wallets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  recovery_type TEXT NOT NULL DEFAULT 'guardian'
    CHECK (recovery_type IN ('guardian', 'email')),
  request_hash TEXT NOT NULL,
  digest TEXT NOT NULL,
  new_passkey_hash TEXT NOT NULL,
  new_passkey_id_raw TEXT NOT NULL,
  new_passkey_json JSONB NOT NULL,
  chain_scope_hash TEXT NOT NULL,
  guardian_addresses TEXT[] NOT NULL,
  threshold INTEGER NOT NULL,
  nonce BIGINT NOT NULL DEFAULT 0,
  valid_after TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  timelock_seconds BIGINT NOT NULL DEFAULT 86400,
  target_chain_ids INTEGER[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'collecting_approvals',
      'threshold_reached',
      'scheduling',
      'scheduled',
      'ready_to_execute',
      'executing',
      'executed',
      'partially_executed',
      'expired',
      'cancelled',
      'failed'
    )),
  requester_note TEXT,
  recovery_intent_json JSONB NOT NULL,
  chain_scopes_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recovery_requests_threshold_valid
    CHECK (threshold > 0 AND threshold <= COALESCE(array_length(guardian_addresses, 1), 0))
);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_user ON public.recovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_wallet ON public.recovery_requests(aa_wallet_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_status ON public.recovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_address ON public.recovery_requests(wallet_address);

CREATE TRIGGER update_recovery_requests_updated_at
  BEFORE UPDATE ON public.recovery_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.recovery_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.recovery_requests(id) ON DELETE CASCADE,
  guardian_address TEXT NOT NULL,
  guardian_index INTEGER NOT NULL,
  sig_kind TEXT NOT NULL CHECK (sig_kind IN ('EOA_ECDSA', 'ERC1271', 'APPROVE_HASH')),
  signature TEXT NOT NULL DEFAULT '0x',
  chain_id INTEGER,
  approval_tx_hash TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'valid', 'invalid')),
  verification_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recovery_approvals_unique_guardian UNIQUE (request_id, guardian_address)
);

CREATE INDEX IF NOT EXISTS idx_recovery_approvals_request ON public.recovery_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_recovery_approvals_status ON public.recovery_approvals(verification_status);

CREATE TABLE IF NOT EXISTS public.recovery_chain_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.recovery_requests(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'wallet_undeployed',
      'module_not_installed',
      'guardians_not_configured',
      'scope_mismatch',
      'scheduling',
      'scheduled',
      'timelock_pending',
      'ready_to_execute',
      'executing',
      'executed',
      'failed',
      'cancelled'
    )),
  schedule_tx_hash TEXT,
  execute_tx_hash TEXT,
  recovery_id_onchain TEXT,
  execute_after TIMESTAMPTZ,
  nonce_at_creation BIGINT,
  guardian_set_hash TEXT,
  policy_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recovery_chain_statuses_unique UNIQUE (request_id, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_chain_statuses_request ON public.recovery_chain_statuses(request_id);

CREATE TRIGGER update_recovery_chain_statuses_updated_at
  BEFORE UPDATE ON public.recovery_chain_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_chain_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery requests"
  ON public.recovery_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recovery requests"
  ON public.recovery_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery requests"
  ON public.recovery_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery requests"
  ON public.recovery_requests FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view approvals for own requests"
  ON public.recovery_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_approvals.request_id
      AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can view chain statuses for own requests"
  ON public.recovery_chain_statuses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_chain_statuses.request_id
      AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage chain statuses for own requests"
  ON public.recovery_chain_statuses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_chain_statuses.request_id
      AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_chain_statuses.request_id
      AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can create chain statuses for own requests"
  ON public.recovery_chain_statuses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_chain_statuses.request_id
      AND r.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.get_recovery_request_for_guardian(
  p_request_id UUID,
  p_guardian_address TEXT
)
RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  guardian_addresses TEXT[],
  threshold INTEGER,
  approval_count BIGINT,
  deadline TIMESTAMPTZ,
  status TEXT,
  digest TEXT,
  requester_note TEXT,
  target_chain_ids INTEGER[],
  recovery_intent_json JSONB,
  chain_scopes_json JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id,
         r.wallet_address,
         r.guardian_addresses,
         r.threshold,
         (
           SELECT COUNT(*)
           FROM public.recovery_approvals approvals
           WHERE approvals.request_id = r.id
             AND approvals.verification_status = 'valid'
         ) AS approval_count,
         r.deadline,
         r.status,
         r.digest,
         r.requester_note,
         r.target_chain_ids,
         r.recovery_intent_json,
         r.chain_scopes_json,
         r.created_at
  FROM public.recovery_requests r
  WHERE r.id = p_request_id
    AND (
      p_guardian_address IS NULL
      OR p_guardian_address = ''
      OR lower(p_guardian_address) = '0x0000000000000000000000000000000000000000'
      OR lower(p_guardian_address) = ANY (
        SELECT lower(unnest(r.guardian_addresses))
      )
    )
    AND r.status IN ('collecting_approvals', 'threshold_reached');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.recovery_requests IS
  'Level 2 guardian recovery request metadata. UX cache only - contract is authority.';
COMMENT ON TABLE public.recovery_approvals IS
  'Guardian approval signatures collected off-chain. Verified by contract at schedule time.';
COMMENT ON TABLE public.recovery_chain_statuses IS
  'Per-chain recovery progress tracking. Verify against on-chain state.';
