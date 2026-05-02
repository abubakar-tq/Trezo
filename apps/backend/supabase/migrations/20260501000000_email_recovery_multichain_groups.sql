-- Level 3 zk-email multichain recovery group schema.
-- Stores one group-level multichain recovery intent and per-chain proof/execution children.
-- UX-only: the EmailRecovery contract and zk-email proofs remain the authority.

-- =====================================================
-- email_recovery_groups
-- One row per multichain recovery intent created by the wallet owner.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_recovery_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID REFERENCES public.aa_wallets(id) ON DELETE SET NULL,
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  smart_account_address TEXT NOT NULL,
  wallet_index INTEGER,
  chain_ids INTEGER[] NOT NULL,
  chain_scope_hash TEXT NOT NULL,
  recovery_intent_hash TEXT NOT NULL,
  multichain_recovery_data_hash TEXT NOT NULL,
  new_passkey_hash TEXT NOT NULL,
  new_passkey_id_raw_hash TEXT NOT NULL,
  new_passkey_pubkey_x TEXT NOT NULL,
  new_passkey_pubkey_y TEXT NOT NULL,
  new_passkey_json JSONB NOT NULL,
  recovery_data TEXT NOT NULL,
  valid_after TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sending_approvals','collecting_approvals','threshold_reached','proofs_submitting','ready_to_execute','executing','partially_executed','executed','expired','cancelled','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS email_recovery_groups_user_id_idx ON public.email_recovery_groups(user_id);
CREATE INDEX IF NOT EXISTS email_recovery_groups_smart_account_idx ON public.email_recovery_groups(smart_account_address);
CREATE INDEX IF NOT EXISTS email_recovery_groups_status_idx ON public.email_recovery_groups(status);

CREATE TRIGGER update_email_recovery_groups_updated_at
  BEFORE UPDATE ON public.email_recovery_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.email_recovery_groups IS
  'Level 3 zk-email multichain recovery group. UX cache only - contract and proofs are authority.';

-- =====================================================
-- email_recovery_chain_requests
-- One row per chain per group. Tracks per-chain proof submission and execution.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_recovery_chain_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.email_recovery_groups(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  smart_account_address TEXT NOT NULL,
  email_recovery_module TEXT NOT NULL,
  email_recovery_manager TEXT,
  command_handler TEXT,
  nonce_at_creation BIGINT NOT NULL,
  guardian_set_hash TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','proofs_pending','proofs_submitted','threshold_reached','timelock_pending','ready_to_execute','executing','executed','failed','cancelled')),
  timelock_ends_at TIMESTAMPTZ,
  schedule_tx_hash TEXT,
  execute_tx_hash TEXT,
  executed_block_number BIGINT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_chain_requests_unique UNIQUE (group_id, chain_id)
);

CREATE INDEX IF NOT EXISTS email_recovery_chain_requests_group_id_idx ON public.email_recovery_chain_requests(group_id);
CREATE INDEX IF NOT EXISTS email_recovery_chain_requests_chain_id_idx ON public.email_recovery_chain_requests(chain_id);
CREATE INDEX IF NOT EXISTS email_recovery_chain_requests_status_idx ON public.email_recovery_chain_requests(status);

CREATE TRIGGER update_email_recovery_chain_requests_updated_at
  BEFORE UPDATE ON public.email_recovery_chain_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.email_recovery_chain_requests IS
  'Per-chain recovery progress for an email recovery group. Verify against on-chain state.';

-- =====================================================
-- email_recovery_approvals
-- One row per guardian per group. Tracks the group-level approval status.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_recovery_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.email_recovery_groups(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES public.email_recovery_guardians(id) ON DELETE SET NULL,
  guardian_email_hash TEXT NOT NULL,
  masked_email TEXT,
  relayer_request_id TEXT,
  email_nullifier TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','email_sent','guardian_replied','proof_generated','submitted_to_chains','confirmed','failed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_approvals_unique UNIQUE (group_id, guardian_email_hash)
);

CREATE INDEX IF NOT EXISTS email_recovery_approvals_group_id_idx ON public.email_recovery_approvals(group_id);
CREATE INDEX IF NOT EXISTS email_recovery_approvals_status_idx ON public.email_recovery_approvals(status);
CREATE INDEX IF NOT EXISTS email_recovery_approvals_nullifier_idx ON public.email_recovery_approvals(email_nullifier)
  WHERE email_nullifier IS NOT NULL;

CREATE TRIGGER update_email_recovery_approvals_updated_at
  BEFORE UPDATE ON public.email_recovery_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.email_recovery_approvals IS
  'Per-guardian approval tracking for an email recovery group. UX metadata only.';

-- =====================================================
-- email_recovery_chain_approval_submissions
-- One row per guardian per chain per group. Tracks per-chain proof submission.
-- Supports both reusable and per-chain proof modes.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_recovery_chain_approval_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.email_recovery_approvals(id) ON DELETE CASCADE,
  chain_request_id UUID NOT NULL REFERENCES public.email_recovery_chain_requests(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  relayer_request_id TEXT,
  email_auth_msg_json JSONB,
  proof_hash TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','request_sent','proof_ready','submitting','submitted','confirmed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_chain_approval_submissions_unique UNIQUE (approval_id, chain_request_id)
);

CREATE INDEX IF NOT EXISTS email_recovery_chain_approval_submissions_chain_request_id_idx
  ON public.email_recovery_chain_approval_submissions(chain_request_id);
CREATE INDEX IF NOT EXISTS email_recovery_chain_approval_submissions_status_idx
  ON public.email_recovery_chain_approval_submissions(status);

CREATE TRIGGER update_email_recovery_chain_approval_submissions_updated_at
  BEFORE UPDATE ON public.email_recovery_chain_approval_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.email_recovery_chain_approval_submissions IS
  'Per-guardian per-chain proof submission tracking. Supports reusable and per-chain proof modes.';

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.email_recovery_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_chain_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_chain_approval_submissions ENABLE ROW LEVEL SECURITY;

-- Groups: direct user_id ownership
CREATE POLICY "Users can view own email recovery groups"
  ON public.email_recovery_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email recovery groups"
  ON public.email_recovery_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email recovery groups"
  ON public.email_recovery_groups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email recovery groups"
  ON public.email_recovery_groups FOR DELETE
  USING (auth.uid() = user_id);

-- Chain requests: ownership through parent group
CREATE POLICY "Users can view chain requests for own groups"
  ON public.email_recovery_chain_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_chain_requests.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can create chain requests for own groups"
  ON public.email_recovery_chain_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_chain_requests.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can update chain requests for own groups"
  ON public.email_recovery_chain_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_chain_requests.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete chain requests for own groups"
  ON public.email_recovery_chain_requests FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_chain_requests.group_id
      AND g.user_id = auth.uid()
  ));

-- Approvals: ownership through parent group
CREATE POLICY "Users can view approvals for own groups"
  ON public.email_recovery_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_approvals.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can create approvals for own groups"
  ON public.email_recovery_approvals FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_approvals.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can update approvals for own groups"
  ON public.email_recovery_approvals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_approvals.group_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete approvals for own groups"
  ON public.email_recovery_approvals FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_groups g
    WHERE g.id = email_recovery_approvals.group_id
      AND g.user_id = auth.uid()
  ));

-- Chain approval submissions: ownership through approval -> group
CREATE POLICY "Users can view chain approval submissions for own groups"
  ON public.email_recovery_chain_approval_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_approvals a
    JOIN public.email_recovery_groups g ON g.id = a.group_id
    WHERE a.id = email_recovery_chain_approval_submissions.approval_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can create chain approval submissions for own groups"
  ON public.email_recovery_chain_approval_submissions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_recovery_approvals a
    JOIN public.email_recovery_groups g ON g.id = a.group_id
    WHERE a.id = email_recovery_chain_approval_submissions.approval_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can update chain approval submissions for own groups"
  ON public.email_recovery_chain_approval_submissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_approvals a
    JOIN public.email_recovery_groups g ON g.id = a.group_id
    WHERE a.id = email_recovery_chain_approval_submissions.approval_id
      AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete chain approval submissions for own groups"
  ON public.email_recovery_chain_approval_submissions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.email_recovery_approvals a
    JOIN public.email_recovery_groups g ON g.id = a.group_id
    WHERE a.id = email_recovery_chain_approval_submissions.approval_id
      AND g.user_id = auth.uid()
  ));
