-- Add guardian acceptance tracking to email_recovery_guardians.
-- After configuring email recovery, guardians must accept their role through
-- the ZK Email flow (real) or harness script (Anvil). The mobile app should
-- show "awaiting approval" until the guardian is accepted on-chain.

ALTER TABLE public.email_recovery_guardians
  ADD COLUMN IF NOT EXISTS acceptance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (acceptance_status IN ('pending', 'acceptance_email_sent', 'accepted', 'failed'));

ALTER TABLE public.email_recovery_guardians
  ADD COLUMN IF NOT EXISTS acceptance_relayer_request_id TEXT;

ALTER TABLE public.email_recovery_guardians
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.email_recovery_guardians
  ADD COLUMN IF NOT EXISTS acceptance_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_recovery_guardians_acceptance_status_idx
  ON public.email_recovery_guardians (acceptance_status);

COMMENT ON COLUMN public.email_recovery_guardians.acceptance_status IS
  'Guardian acceptance status. pending = not yet invited or not yet responded. acceptance_email_sent = ZK Email relayer sent acceptance email. accepted = on-chain acceptGuardian confirmed. failed = acceptance failed or expired.';
COMMENT ON COLUMN public.email_recovery_guardians.acceptance_relayer_request_id IS
  'Relayer request ID for the acceptance email sent via ZK Email hosted relayer.';
COMMENT ON COLUMN public.email_recovery_guardians.accepted_at IS
  'Timestamp when the guardian acceptance was confirmed on-chain.';
COMMENT ON COLUMN public.email_recovery_guardians.acceptance_checked_at IS
  'Last time the acceptance status was checked against on-chain state.';
