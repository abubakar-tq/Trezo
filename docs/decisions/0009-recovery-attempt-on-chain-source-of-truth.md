# On-chain `recoveryRequests` is the source of truth for Recovery Attempt execution lifecycle; Supabase holds only what is not on-chain

**Status:** accepted
**Date:** 2026-05-29

## Decision

For a **Recovery Attempt** (CONTEXT.md), the on-chain `EmailRecoveryManager.recoveryRequests[account]` slot is the authoritative source of execution-lifecycle state: whether an attempt is active, the vote progress (`currentWeight` vs `threshold`), the executable window (`executeAfter`, `executeBefore`), and the payload hash being voted on (`recoveryDataHash`).

Supabase `email_recovery_attempts` and its child tables hold only state that is **not on-chain by design**:

- Vault-encrypted guardian emails
- prove.email per-guardian `request_id`s used to poll proof generation
- The `recovery_data` bytes (needed off-chain to call `completeRecovery`; the chain stores only the keccak hash)
- The new passkey JSON the Attempt is rotating to
- Pre-vote lifecycle states (no row exists in `EmailRecoveryManager.recoveryRequests` until prove.email submits the proof)

prove.email's `requestStatus` is authoritative for *email-flow* state: DKIM verification, ZK proof generation, whether their relayer EOA submitted `handleRecovery` for us.

Reconciliation rule: every recovery-related screen on mount reads all three sources, and **on disagreement about execution lifecycle, on-chain wins**. To disambiguate the race during a `completeRecovery` confirmation (on-chain `recoveryRequests` zeros within the same block the receipt is observed), the app checks `PasskeyValidator.passkeyCount(account)` against a cached pre-execution baseline — if the count increased by 1, the Attempt completed.

## Why

Through the v1 testing cycles we hit repeated drift between Supabase's polled `status` columns and the actual on-chain state. Symptoms included:

- "Stuck on Loading recovery status" while the on-chain vote had already landed
- Three Supabase rows for the same smart account because client code re-inserted before observing prove.email's confirmation
- A perceived "hash mismatch" between Supabase's `multichain_recovery_data_hash` and BaseScan's `recoveryDataHash` (different hash computations of the same data)
- An "expired" Attempt the user couldn't unblock because the Supabase row's `status` column didn't reflect that the on-chain `executeBefore` had elapsed

Supabase is a high-latency mirror of state that already exists authoritatively somewhere else. Treating it as the source of truth for what the chain knows means every screen has to wait for `/poll-group-status` to fire before it can render — and every poll-cycle bug becomes a UX failure.

Inverting the dependency removes a whole class of bugs: the screen reads on-chain directly (cheap, batched via Multicall3, intervals tuned to the lifecycle phase), Supabase becomes a side-store for the things the chain doesn't know about (encrypted email metadata, prove.email correlations, the `recovery_data` bytes).

## Considered alternatives

- **Keep Supabase as source of truth, fix the polling**: rejected. The polling is fragile by nature — even with retries and better polling intervals, the half-second window between on-chain change and Supabase update is a permanent bug surface. We hit this in three separate flavors during v1.
- **Mirror on-chain into Supabase via a chain indexer**: rejected. Would require running an indexer (new infra burden), and the indexer itself has the same latency problem one layer down. Trezo already pays for Ponder (`apps/backend/indexer`) for other things but adding recovery state to it is overkill for a single user's single-Attempt cardinality.
- **Polling-only, no on-chain reads from the mobile client**: rejected. This is the status quo and is what we're rejecting.

## Consequences

### Supabase schema cleanup

The following columns are dropped because they mirror on-chain or prove.email state:

- `email_recovery_groups.status` (`collecting_approvals`, `threshold_reached`, `ready_to_execute`, `executed`, `executing`, `failed`) — derived from on-chain reads
- `email_recovery_chain_requests.status` — same per-chain
- `email_recovery_chain_approval_submissions.status` — derived from prove.email's `requestStatus`
- `email_recovery_chain_approval_submissions.proof_hash` — decorative; the real proof is on-chain
- `email_recovery_approvals.status` — derived from prove.email's per-guardian `requestStatus`
- `email_recovery_groups.deadline` — replaced by on-chain `executeBefore` once vote lands; pre-vote, replaced by a Supabase-side cron TTL that deletes rows whose `created_at + 24h < now()` and have no on-chain activity

Kept because not derivable from chain or prove.email:

- `email_recovery_groups.recovery_data` (bytes)
- `email_recovery_groups.new_passkey_json` + `new_passkey_id_raw_hash`
- `email_recovery_groups.multichain_recovery_data_hash` — embedded in the email command template; replacement would require a contract change
- `email_recovery_groups.smart_account_address`, `chain_ids`, `user_id`, `config_id`
- `email_recovery_guardians.normalized_email_encrypted`, `email_hash`, `masked_email`, `weight`
- `email_recovery_guardians.acceptance_relayer_request_id`
- `email_recovery_chain_approval_submissions.relayer_request_id`
- `email_recovery_chain_requests.email_recovery_module` — per-chain `EmailRecovery` address; needed for prove.email's `controller_eth_addr` (failure to pass this correctly was the bug that prevented our first recovery from landing)
- `email_recovery_configs.*`

The `'draft'` status state is removed; rows are inserted lazily, immediately before the first email-send call. Cancellation deletes the Supabase row outright (no `'cancelled'` audit row for testnet) and additionally calls `cancelRecovery` on-chain if the vote had landed.

### RPC budget

Chain reads are made through three combined levers to stay within public RPC limits:

- **Multicall3**: every polling cycle issues a single `multicall3.aggregate3(...)` call to `0xcA11bde05977b3631167028862bE2a173976CA11` on Base Sepolia, batching `getRecoveryRequest`, `getGuardianConfig`, `passkeyCount`, and event filters into one round-trip.
- **Lifecycle-aware intervals**: 8s while waiting for guardian email reply (poll prove.email, not chain), 60s during the same phase for chain reads; tighten to 5s once prove.email reports `ProofGenerated`, 3s during `completeRecovery` confirmation; back off to 60s after 5 minutes of idle, pause entirely after 15 minutes.
- **Banner-on-Supabase**: the "Recovery Attempt in progress" banner that may appear on Home and Profile reads only Supabase (a single existence SELECT) and never pays an RPC call. Detail screen is where chain reads happen.

Target: ≤50 chain reads per Recovery Attempt across the whole lifecycle.

### Failure mode reversal

Drift bugs become self-healing instead of permanent. When the on-chain state shows an Attempt has executed but Supabase still has a row in `'executing'` (impossible going forward since `status` is dropped — but for transitional rows from old schema), the detail screen reads on-chain, sees the completion, and offers a one-tap **Clear** that deletes the stale Supabase row. The banner stops appearing on next render.

## Related

- CONTEXT.md → "Recovery Attempt", "Recovery Attempt — source of truth split", "RPC budget for chain reads", "Supabase columns kept after cleanup"
- ADR-0006 — UI gated to Base Sepolia; v1 polish operates only on that chain
- ADR-0010 — expired-slot reclamation via Trezo-operated EOA
- `docs/plans/email-recovery-polish.md` — implementation brief
