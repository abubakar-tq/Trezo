-- ADR-0009: On-chain is source of truth for Recovery Attempt execution lifecycle.
-- Drop Supabase columns that mirror on-chain or prove.email state; add lifecycle
-- timestamps that the mobile hook writes when it observes on-chain events.

-- ─── email_recovery_groups ───────────────────────────────────────────────────
-- status: mirrors on-chain execution phase (collecting_approvals,
--         ready_to_execute, executed…) — now derived from on-chain reads only.
-- deadline: mirrors on-chain executeBefore (post-vote); replaced by executed_at
--           / deleted_at below. Pre-vote TTL enforced by created_at + 24h cron.
-- last_error: per-attempt debug noise; errors surface via prove.email requestStatus.
ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS deadline;
ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS last_error;

-- ─── email_recovery_chain_requests ───────────────────────────────────────────
-- status: mirrors on-chain per-chain execution state.
-- last_error / last_checked_at: polling artifacts removed with the polling loop.
ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS last_error;
ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS last_checked_at;

-- ─── email_recovery_chain_approval_submissions ───────────────────────────────
-- status: mirrors prove.email per-submission state.
-- proof_hash: decorative — the real proof is on-chain; not needed for completeRecovery.
-- email_auth_msg_json: large transient blob; prove.email is authoritative.
-- last_error: debug noise.
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS proof_hash;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS last_error;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS email_auth_msg_json;

-- ─── email_recovery_approvals ────────────────────────────────────────────────
-- status: mirrors prove.email per-guardian state.
-- last_error: debug noise.
ALTER TABLE email_recovery_approvals DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_approvals DROP COLUMN IF EXISTS last_error;

-- ─── lifecycle timestamps (replace status on email_recovery_groups) ──────────
-- executed_at IS NOT NULL → Recovery Attempt completed (PasskeyAddedViaRecovery seen)
-- deleted_at  IS NOT NULL → Recovery Attempt cancelled or stale-cleared
-- Both null              → Recovery Attempt is in-flight (on-chain is authoritative)
-- See ADR-0009 and CONTEXT.md "Recovery Attempt — source of truth split".
ALTER TABLE email_recovery_groups ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE email_recovery_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for the banner's existence check and the resume-sheet pre-check.
-- Query shape: WHERE smart_account_address = ? AND deleted_at IS NULL AND executed_at IS NULL
CREATE INDEX IF NOT EXISTS email_recovery_groups_active_by_account
  ON email_recovery_groups (smart_account_address)
  WHERE deleted_at IS NULL AND executed_at IS NULL;

-- NOTE: email_recovery_guardians.acceptance_status (mirrors on-chain getGuardian)
-- is intentionally NOT dropped here. EmailRecoveryService.ts still reads it for
-- the guardian-setup flow. Drop it in a follow-up migration once that service is
-- updated to read on-chain directly (Phase 2 / 3 of the v1 polish).
