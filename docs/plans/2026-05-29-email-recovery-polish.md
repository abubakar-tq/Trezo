# Email Recovery v1 Polish — Implementation Brief

**Date:** 2026-05-29
**Owner:** to be assigned (executor model)
**Status:** Ready for execution
**Estimated effort:** ~2 working days

## Context

This plan implements the email-recovery polish work grilled out across the 2026-05-29 session. Before starting, read in order:

1. [CONTEXT.md](../../CONTEXT.md) — sections on "Recovery Attempt", "Recovery Attempt — source of truth split", "Recovery Attempt — entry point semantics", "Recovery Attempt — expired-slot reclamation", "RPC budget for chain reads", "Supabase columns kept after cleanup"
2. [ADR-0009](../decisions/0009-recovery-attempt-on-chain-source-of-truth.md) — execution lifecycle source of truth + Supabase schema cleanup
3. [ADR-0010](../decisions/0010-cancel-expired-recovery-via-server-eoa.md) — server-side cancellation flow
4. [ADR-0011](../decisions/0011-recovery-attempt-initiated-from-new-device-only.md) — production vs testing entry-point split
5. [ADR-0006](../decisions/0006-email-recovery-deployed-everywhere-ui-gated.md) — UI is gated to Base Sepolia

**You are allowed minor judgment calls within the scope of this plan** (e.g., naming a private helper, choosing a state-machine library, picking specific field names in the new edge function response shape). **Anything that would require a change to CONTEXT.md or trigger a new ADR comes back to the user for grilling.**

Use the canonical term **Recovery Attempt** throughout new code, comments, and UI strings. Avoid "recovery group", "ongoing recovery", "in-flight recovery".

## Non-goals

- The production unauthenticated welcome screen ("Recover account via email" CTA) — v2 scope per ADR-0011
- Multi-chain UI enablement — v2 scope, waits for ADR-0006 revision
- Contract changes — none in v1; if you find yourself wanting one, stop and surface it
- Renaming Supabase tables (`email_recovery_groups` → `email_recovery_attempts`) — cosmetic and risky; touches the guardian-approval web app; defer to a follow-up

## Pre-flight (do these first, document outcomes)

### P.1 Fund the relayer EOA on Base Sepolia

The cancel-expired action depends on `RECOVERY_RELAYER_PRIVATE_KEY` having Base Sepolia ETH. Confirm balance via Supabase secrets + a one-time RPC check. If under 0.05 ETH, fund from the Coinbase Base Sepolia faucet (https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) or QuickNode faucet. Document the EOA address in this file under "Operational notes" at the end when done.

### P.2 Baseline tests pass

Run `npm --workspace apps/backend/zk-email-recovery-api run test` and `npm --workspace apps/backend/zk-email-recovery-api run build`. Both must pass (30 tests, clean tsc) before you start changing anything. If they don't, fix that first; do not proceed.

### P.3 Capture the current screen flow as a baseline

Take screenshots of `EmailRecoveryScreen` and `EmailRecoveryGroupStatusScreen` in their current state with a real Recovery Attempt in progress. Save to `docs/plans/2026-05-29-email-recovery-polish/baseline/` so we can show the before/after at PR review time.

## Phase 1 — Supabase schema cleanup

### 1.1 Migration: drop mirror columns

Create `apps/backend/supabase/migrations/20260529000000_drop_recovery_mirror_columns.sql`:

```sql
-- ADR-0009: on-chain is source of truth for execution lifecycle.
-- Drop columns that mirror on-chain or prove.email state.

ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS deadline;
ALTER TABLE email_recovery_groups DROP COLUMN IF EXISTS last_error;

ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS last_error;
ALTER TABLE email_recovery_chain_requests DROP COLUMN IF EXISTS last_checked_at;

ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS proof_hash;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS last_error;
ALTER TABLE email_recovery_chain_approval_submissions DROP COLUMN IF EXISTS email_auth_msg_json;

ALTER TABLE email_recovery_approvals DROP COLUMN IF EXISTS status;
ALTER TABLE email_recovery_approvals DROP COLUMN IF EXISTS last_error;
```

Caveats:

- Several Supabase Edge Functions and Postgres functions (`list_recovery_requests_for_guardian`, `inbox_includes_in_progress`) reference these columns. Update them in the same migration or a paired one to read derived state instead. Specifically:
  - `list_recovery_requests_for_guardian` returns rows that "match" certain `status` values — change it to return rows where `executed_at IS NULL AND deleted_at IS NULL` (you may need to add `executed_at` and `deleted_at` timestamp columns to `email_recovery_groups`).
- `email_recovery_guardians.acceptance_status` is referenced by the mobile polling code. Drop it but verify mobile code is rewritten to read on-chain via `getGuardian` (see Phase 3.4).

### 1.2 Add `executed_at` and `deleted_at` to `email_recovery_groups`

Same migration:

```sql
ALTER TABLE email_recovery_groups ADD COLUMN IF NOT EXISTS executed_at timestamptz;
ALTER TABLE email_recovery_groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS email_recovery_groups_active_by_account
  ON email_recovery_groups (smart_account_address) WHERE deleted_at IS NULL AND executed_at IS NULL;
```

These two columns replace the dropped `status` field:

- `executed_at IS NOT NULL` → Attempt completed (PasskeyAddedViaRecovery event observed)
- `deleted_at IS NOT NULL` → Attempt cancelled or stale-cleared
- Both null → Attempt is in-flight (whatever on-chain says)

### 1.3 Drop `'draft'` lifecycle insertion

In `EmailRecoveryGroupService.createGroup` ([apps/mobile/src/features/wallet/services/EmailRecoveryGroupService.ts](../../apps/mobile/src/features/wallet/services/EmailRecoveryGroupService.ts)):

- Today: insert with `status: 'draft'`, then update to `'collecting_approvals'` right before first email send.
- After: insert the row **immediately before** the first prove.email `sendRecoveryRequest` call. The row inserts and the email fires in the same try/catch. If the relayer call throws, the row insert is rolled back via try/catch + Supabase delete.
- The `status` column is gone anyway; this is now just about the timing of the INSERT.

### 1.4 Cancellation = delete

`EmailRecoveryGroupService.cancelGroup`:

- Today: sets `status = 'cancelled'`.
- After: sets `deleted_at = NOW()` (soft delete) AND attempts on-chain `cancelRecovery()` UserOp (Pimlico-sponsored) if the user is on a device with a passkey. Swallow the on-chain revert for "nothing to cancel."
- The "Resume sheet" flow (Phase 4.3) treats `deleted_at IS NOT NULL` as cleared.

### 1.5 Edge function `submit-recovery-operation`: new action

[apps/backend/supabase/functions/submit-recovery-operation/index.ts](../../apps/backend/supabase/functions/submit-recovery-operation/index.ts):

Add a new action handler. Inputs: `{ smartAccountAddress: string, chainId: number }`. Steps:

1. Validate inputs (address format, chainId in supported list).
2. Read `EmailRecovery.getRecoveryRequest(account)` on the supplied chain via viem `publicClient.readContract`.
3. If `result.executeBefore === 0n` → return `{ status: "no-op", reason: "no active recovery" }` with 200.
4. If `result.executeBefore > now` → return `{ status: "skipped", reason: "not yet expired", executeBefore: ... }` with 200.
5. Otherwise sign and submit `cancelExpiredRecovery(account)` via `walletClient.writeContract`. Wait for receipt.
6. Return `{ status: "cleared", txHash }` with 200.

Idempotent: if you call it twice, the second call sees `executeBefore === 0` and returns no-op. Add a defensive try/catch around the write to return `{ status: "failed", reason: error.message }` with 200 (not 500) — the mobile handles failure explicitly.

Update existing `whoami` action to include `relayerBalanceWei` per chain (start with just Base Sepolia, single field).

### 1.6 Run the existing 30 backend tests + add new ones

Vitest cases under `apps/backend/zk-email-recovery-api/src/` covering the new edge-function action are NOT in scope for that workspace — `submit-recovery-operation` is a Deno edge function, not an Express route. Instead add a `__tests__/` directory inside `apps/backend/supabase/functions/submit-recovery-operation/` with Deno-native test files. Mock viem reads with a stub RPC; cover all four return branches (no-op, skipped, cleared, failed).

## Phase 2 — Mobile on-chain hook

### 2.1 Add a `useRecoveryAttemptState` hook

New file: `apps/mobile/src/features/wallet/hooks/useRecoveryAttemptState.ts`.

Signature:

```ts
export type RecoveryAttemptState =
  | { phase: "idle"; lastSeenPasskeyCount: bigint }
  | { phase: "awaiting-vote"; chainId: SupportedChainId; relayerStatuses: ProveEmailStatus[] }
  | { phase: "vote-landed-pre-execute"; chainId: SupportedChainId; executeAfter: number; executeBefore: number }
  | { phase: "executable"; chainId: SupportedChainId; executeAfter: number; executeBefore: number; recoveryDataHash: Hex }
  | { phase: "executing"; chainId: SupportedChainId; txHash?: Hex }
  | { phase: "executed"; chainId: SupportedChainId; newPasskeyId: Hex; passkeyCount: bigint }
  | { phase: "expired"; chainId: SupportedChainId; executeBefore: number }
  | { phase: "error"; reason: string };

export function useRecoveryAttemptState(params: {
  smartAccountAddress: Address;
  chainId: SupportedChainId;
  attemptId?: string; // Supabase row UUID; if absent, hook just observes chain
}): {
  state: RecoveryAttemptState;
  triggerExecute: () => Promise<void>; // calls prove.email /completeRequest
  triggerCancelExpired: () => Promise<void>; // calls Supabase edge fn
  refetch: () => Promise<void>;
};
```

Implementation:

- Uses Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`) to batch `getRecoveryRequest`, `getGuardianConfig`, `passkeyCount` in one round-trip.
- Polling interval comes from the lifecycle phase (see ADR-0009 "RPC budget" section). Implement as a state-machine-driven `setTimeout` rather than a fixed `setInterval`.
- Tracks the pre-Attempt `passkeyCount` once on hook mount as the "before" baseline; uses delta to disambiguate the post-`completeRecovery` race.
- Subscribes to relevant events (`RecoveryRequestStarted`, `RecoveryRequestComplete`, `RecoveryExecuted`, `RecoveryCompleted`, `PasskeyAddedViaRecovery`) via `eth_getLogs` polling (no WebSocket; public RPC doesn't reliably support subs).

### 2.2 Add a `useActiveRecoveryAttemptId` hook (Supabase-only, for the banner)

`apps/mobile/src/features/wallet/hooks/useActiveRecoveryAttemptId.ts`:

```ts
export function useActiveRecoveryAttemptId(smartAccountAddress: Address): {
  attemptId: string | null;
  loading: boolean;
};
```

Implementation: single Supabase `SELECT id FROM email_recovery_groups WHERE smart_account_address = ? AND deleted_at IS NULL AND executed_at IS NULL LIMIT 1`. No chain RPC. Refresh on app foreground and on a 30s timer while in foreground.

### 2.3 Rewrite `EmailRecoveryGroupService` to drop mirror writes

Methods to revise:

- `sendApprovals` — stop writing to `acceptance_status`, `last_error`. Read those from prove.email on demand via the new hook.
- `executeReadyChains` — stop reading `chain_request.status === 'ready_to_execute'`. Instead accept a `(smartAccountAddress, chainId, attemptId)` triple and read on-chain to confirm executable, then call `adapter.completeRecovery(...)`.
- `refreshGroupStatus` — delete; the hook replaces it.
- `pollGuardianAcceptanceStatuses` — delete (it's already broken-ish); the hook reads on-chain `getGuardian` directly.

Be defensive: write deprecation comments above any function you delete pointing at the new hook so the next AI/agent doesn't try to revive it.

### 2.4 Update the existing Resend Invite path

`EmailRecoveryService.resendGuardianAcceptanceInvite` (already exists) — surface the upstream prove.email error in the alert (already half-done per session notes). Confirm the "Account code already used" detection special-case still works.

## Phase 3 — Edge functions and prove.email integration sanity

### 3.1 Verify all five existing prove.email integrations still work after the schema cleanup

- `/acceptanceRequest` — controllerEthAddr = EmailRecovery module addr (NOT smart account; bug we fixed)
- `/recoveryRequest` — same correction; verify chainReq.email_recovery_module is the source
- `/requestStatus` — read-only, no schema dependence
- `/completeRequest` — passes recovery_data bytes; not affected by status column drops
- `/getAccountSalt` — returns plain text not JSON (already handled)

### 3.2 Confirm cancel-expired call path

End-to-end test via curl (document in `RECOVERY_RUNBOOK.md` you'll create in Phase 6):

```bash
curl -X POST <SUPABASE_URL>/functions/v1/submit-recovery-operation \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{ "action": "cancel-expired-email-recovery", "smartAccountAddress": "0x…", "chainId": 84532 }'
```

Three test cases:

1. With no active recovery → expect `{ status: "no-op" }`
2. With active-not-expired → expect `{ status: "skipped" }`
3. With expired → expect `{ status: "cleared", txHash: "0x…" }` and verify on-chain via `getRecoveryRequest` returning zeros

## Phase 4 — UI redesign

### 4.1 Banner component

New file: `apps/mobile/src/shared/components/banners/RecoveryAttemptBanner.tsx`.

- Reads `useActiveRecoveryAttemptId(smartAccountAddress)`.
- If `attemptId` is non-null: renders a one-line soft banner *"Recovery in progress — Tap to view"* with a `arrow-right` icon. Dismissable per session (stored in zustand, not persisted).
- Tap → `navigation.navigate("RecoveryAttemptStatus", { attemptId })`.
- Reuses the existing styled-banner pattern from `apps/mobile/src/shared/components/banners/` if one exists; otherwise create a small companion to `recoveryKitBanner` styles inlined elsewhere.

Mount in two places:

- `HomeScreen` — above the BalanceCard, dismissable.
- `ProfileScreen` — inside the Recovery section, sticky (not dismissable).

### 4.2 Rewrite `EmailRecoveryGroupStatusScreen` per Q9b decluttering

Rename file to `RecoveryAttemptStatusScreen.tsx` (matches the new canonical term). Update navigation route name to `RecoveryAttemptStatus`. Update `RootStackParamList` and the param type to `{ attemptId: string }`.

Three blocks total (drop everything else):

1. **Top status pill** — derived from `useRecoveryAttemptState`. Reactive single-line: "Awaiting guardian reply", "Vote landed — installing in 32s", "Installing new passkey…", "Recovery complete ✓", "Recovery Attempt expired".
2. **Per-guardian section** — list rows: masked email + state badge ("Awaiting reply" / "Reply received, proof pending" / "Voted ✓" / "Failed — Retry"). Inline ↻ resend button per row. Aggregate "X of Y confirmed" line.
3. **Per-chain inline progress** (one row for v1 Base Sepolia) — four step inline chips: Vote ✓ → Delay ✓ → Executing… → Done. State derived from `useRecoveryAttemptState.phase`.

Drop:

- The "Each guardian must accept their role…" instructional paragraph. Move to a `__DEV__`-only tooltip.
- The "WAITING FOR GUARDIAN APPROVALS" placeholder block — covered by the status pill.
- The "Hash" row in the visible header. Expose under `•••` overflow → "Copy debug info".

Header overflow menu (`•••`) contains:

- Copy debug info (hash, group ID, chain IDs)
- Cancel Recovery Attempt → triggers the cancellation flow from 1.4

### 4.3 Resume sheet

New file: `apps/mobile/src/features/profile/screens/RecoveryAttemptResumeSheet.tsx`.

Triggered from `EmailRecoveryScreen.handleInstallModule` (the dev-only "Start Email Recovery" flow). Before creating a new group:

1. Check `useActiveRecoveryAttemptId`.
2. If existing Attempt → present a `BottomSheetModal` with copy: *"You have a Recovery Attempt in progress (started X min ago, awaiting guardian r***@g***.com). Continue with it or cancel and start new?"*
3. Buttons: `[Continue]` → navigate to `RecoveryAttemptStatus`. `[Cancel and Start New]` → call cancellation flow (1.4), wait for it, then proceed to create new Attempt.

### 4.4 Auto-execute integration

Inside `RecoveryAttemptStatusScreen`, when `useRecoveryAttemptState.state.phase === 'executable'`, call `triggerExecute()` exactly once. Show a non-blocking toast: *"Installing new passkey 0x6ade2a7f…"*. Don't gate; this is fire-and-forget per ADR-0011.

### 4.5 Auto-clear-expired integration

`EmailRecoveryScreen.handleInstallModule` (start of flow): before creating any Supabase row, read on-chain `getRecoveryRequest(account)` via the public client. If `executeBefore > 0 && executeBefore < now`, call the new edge function action and surface "Clearing previous expired Recovery Attempt…" loading state. Only then proceed with createGroup.

### 4.6 Dev Controls additions

`DevCreateAccountScreen` already hosts `RestoreOnChainPasskeyCard`. Add three more cards (keep all `__DEV__`-gated):

- **Force Complete card** — input `attemptId`, button "Force complete". Reads `recovery_data` from Supabase, calls `adapter.completeRecovery` directly. Surfaces tx hash. Useful when auto-execute can't fire (e.g., screen never opened during the window).
- **Clear Stale Rows card** — button "Delete all Attempts for this account that are not active on-chain". Reads on-chain, finds Supabase rows where chain says nothing's there, batch-deletes.
- **Relayer Health card** — calls `whoami` action, shows the relayer EOA address + Base Sepolia balance. Visual warning if < 0.001 ETH.

### 4.7 Verify same-device flow is dev-gated

Add `__DEV__` guards around:

- The "Start Email Recovery" button on `EmailRecoveryScreen` (around line 1651 of pre-change file)
- The navigation route registration for `EmailRecoveryStart` in `RootNavigation.tsx`
- The Dev Controls "Restore passkey from on-chain" card (already dev-only by virtue of being on `DevCreateAccountScreen` which is dev-gated; verify)

## Phase 5 — Testing

### 5.1 Supabase edge function tests

Per 1.6: Deno tests for the four return branches of `cancel-expired-email-recovery`.

### 5.2 Mobile hook tests

Vitest tests (will require setting up `apps/mobile/vitest.config.ts` if not present — defer if it doesn't exist, write a setup PR first). At minimum:

- `useRecoveryAttemptState` returns correct phase for each on-chain state
- Polling interval is correct for each phase
- Pre-execution `passkeyCount` baseline is tracked correctly
- Race: when `getRecoveryRequest` returns zeros AND `passkeyCount` incremented since baseline → phase is `"executed"`, not `"idle"`

### 5.3 Component snapshot tests

For `RecoveryAttemptStatusScreen` in each of these states: `awaiting-vote`, `executable`, `executing`, `executed`, `expired`. Use Jest snapshot or react-native-testing-library.

### 5.4 Manual E2E

On Base Sepolia, single user, single Attempt, happy path. Capture screenshots at each phase for the "after" half of the baseline comparison from P.3.

Acceptance criterion: from "Start Email Recovery" through "new passkey installed," the user makes **zero manual taps** after replying to the guardian email. Auto-execute fires inside the screen, the toast appears, and the badge flips. Total wall-clock time from guardian reply to passkey installed: < 5 minutes (limited by prove.email's proof generation queue, not our code).

## Phase 6 — Documentation

### 6.1 CONTEXT.md

Already updated during the grilling session. Re-read to confirm. No further changes needed.

### 6.2 RECOVERY_RUNBOOK.md

New file at repo root: `RECOVERY_RUNBOOK.md`. Sections:

- "When a Recovery Attempt is stuck — diagnostic checklist" with the curl commands we used today (requestStatus, getRecoveryRequest, eth_getLogs)
- "Manual completion via prove.email /completeRequest" — the curl that unblocked us today
- "Funding the relayer EOA" — faucet links, threshold for alarm, contact for refill
- "What to do if `cancel-expired-email-recovery` returns failed" — investigate gas, network issues, contract permissioning

### 6.3 Cross-references in code

Where the new code intersects with concepts in CONTEXT.md or one of the three new ADRs, add a one-line `// See ADR-XXXX` or `// See CONTEXT.md "Recovery Attempt"` comment. Don't over-do it; just at non-obvious decision points (the `passkeyCount` baseline tracking, the lazy edge-function trigger, the multicall batching).

## Operational notes (fill in during execution)

- Relayer EOA address on Base Sepolia: _(record here after funding)_
- Relayer EOA Base Sepolia balance at start of work: _(record)_
- Vitest pre-existing pass count: _(should be 30)_
- Post-work pass count: _(should be 30 + new tests)_
- Baseline screenshots saved to: `docs/plans/2026-05-29-email-recovery-polish/baseline/`
- After screenshots saved to: `docs/plans/2026-05-29-email-recovery-polish/after/`

## Out of scope, captured for v2 backlog

- Production unauthenticated welcome screen with "Recover account via email" CTA (the new-device entry surface)
- Multi-chain Recovery Attempt UI enablement
- Renaming Supabase tables to `email_recovery_attempts*`
- Promoting "Restore passkey from on-chain" out of `__DEV__` (only do this if real user lockouts are observed post-polish)
- Auto-cron clearing expired Attempts in background (lazy trigger covers all real cases)
- Push notifications when a Recovery Attempt is ready to execute and the app is backgrounded

## Final acceptance

PR is ready to merge when:

1. All migrations apply cleanly on the project's Supabase instance
2. `apps/backend/zk-email-recovery-api` tests still pass (30 + any added)
3. New Deno tests for `cancel-expired-email-recovery` pass
4. Mobile typecheck has no NEW errors (existing `@gorhom/bottom-sheet` and similar can stay)
5. Manual E2E from P.3's baseline state to "new passkey installed" succeeds without taps after the guardian reply
6. Before/after screenshots are in the doc folder
7. RECOVERY_RUNBOOK.md is present and the user has read it once
8. The three new ADRs and CONTEXT.md are unchanged from this commit (you should not edit them — if you feel the need to, stop and come back to user)
