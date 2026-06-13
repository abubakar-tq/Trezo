# Expired Recovery Attempt slots are reclaimed by a Trezo-operated server-side EOA, not by user signature

**Status:** accepted
**Date:** 2026-05-29

## Decision

When a Recovery Attempt's on-chain `executeBefore` elapses without `completeRecovery` being called, the slot in `EmailRecoveryManager.recoveryRequests[account]` remains occupied and blocks any new Attempt against the same smart account. Clearing it requires an on-chain `cancelExpiredRecovery(account)` call.

We do this server-side via the existing `submit-recovery-operation` Supabase edge function, signed by the Trezo-operated `RECOVERY_RELAYER_PRIVATE_KEY` EOA (already provisioned for the SocialRecovery path). A new action is added:

```
POST /functions/v1/submit-recovery-operation
{
  "action": "cancel-expired-email-recovery",
  "smartAccountAddress": "0xf4c87c…",
  "chainId": 84532
}
→ { status: "cleared" | "skipped" | "no-op" | "failed", txHash?, reason? }
```

The function reads on-chain `getRecoveryRequest(account)` before submitting to confirm the slot is occupied and expired, so repeat calls are idempotent. Mobile triggers it lazily — only when the user is about to start a fresh Recovery Attempt and the previous one is detected as expired. No user signature is required.

`whoami` is extended to include the relayer EOA's Base Sepolia balance so Dev Controls can surface a low-balance warning before the operational flow gets stuck.

## Why

The production trigger for a Recovery Attempt is **a new device with no passkey on the smart account** (ADR-0011). By definition, that user cannot sign a UserOp from their smart account — recovery is the mechanism that gives them the ability to sign at all. Any policy that requires the user to sign in order to clear an expired slot strands them.

`cancelExpiredRecovery` is permissionless on the contract — any EOA can call it for any account. The choice is therefore not "user vs server" (the user can't sign) but "Trezo's server EOA vs ask the public to clear it for us." A Trezo-operated server EOA is the only reliable answer:

- prove.email's existing `/completeRequest` endpoint doesn't expose cancellation
- A public faucet wallet introduces a third-party coordination dependency that adds operational fragility for the sake of avoiding ~$0.001 of gas per call
- The `RECOVERY_RELAYER_PRIVATE_KEY` EOA is already operational for the SocialRecovery `prepare-schedule` / `prepare-execute` / `record-tx` actions in the same edge function, and gas spend is already a budgeted line item

The gas cost is sub-penny per call on Base Sepolia, and the cardinality is low (one cancel per expired Attempt per user — and expiry is a rare edge case, not a hot path).

## Considered alternatives

- **Require user to sign a Pimlico-sponsored UserOp from their smart account**: rejected. Works for the current testing flow (same-device, user has passkey) but fails in production (new-device, no passkey). Building a v1 flow that doesn't generalize to production wastes the work.
- **prove.email handles expiry cleanup as part of their relayer service**: rejected. prove.email doesn't offer it, and asking them to add it makes us a dependent on a roadmap we don't control. Self-serving on this is cheaper than negotiating.
- **Cron-driven background scan that auto-cleans expired slots**: rejected for v1. Adds permanent infra cost (always-on scanner) for a state that's only relevant at the moment a user is about to restart. Lazy triggering at user-intent time covers all real-world flows.
- **Public faucet wallet via a publicly-callable cancel endpoint**: rejected. Same gas burden as our own EOA, plus a public attack surface (anyone could spam cancels), plus the operational headache of a wallet we don't fully control.

## Consequences

### Operational

- The `RECOVERY_RELAYER_PRIVATE_KEY` EOA must be funded on every chain in scope. At v1 (Base-Sepolia-only) that's a single faucet drip; ~0.05 testnet ETH covers thousands of cancels. Pre-flight checks in Dev Controls warn when the balance drops below threshold.
- A new action handler in `apps/backend/supabase/functions/submit-recovery-operation/index.ts` (~50 lines). Idempotent by virtue of reading on-chain state before acting.
- The mobile path that triggers it: on user intent to start a fresh Attempt, the client reads `getRecoveryRequest(account)` via multicall, branches to the cancel-expired action if `executeBefore != 0 && executeBefore < now`, awaits a brief "Clearing previous expired recovery…" loading state, then proceeds. No biometric prompt.

### Multi-chain future

When ADR-0006 is updated to enable additional chains, the mobile loops `cancel-expired-email-recovery` once per chain in the affected Attempt's `chain_ids` array — no server-side fan-out logic needed. The same EOA must be funded on each new chain.

### Production stranding mitigated

The class of bug "user on new device, previous Attempt expired, slot blocked, user has no way to clear it" is fully removed by this decision. Without it, that user is locked out of recovery entirely.

### Edge-function cost growth

The recovery edge function now has six actions (`whoami`, `prepare-schedule`, `prepare-execute`, `record-tx`, `sync-from-chain`, `cancel-expired-email-recovery`). Further growth is a smell; if a seventh appears, split the file by recovery type.

## Related

- CONTEXT.md → "Recovery Attempt — expired-slot reclamation"
- ADR-0009 — on-chain source of truth for execution lifecycle (this is the operational complement)
- ADR-0011 — production trigger is new-device only (motivates why user signing is not an option)
- `apps/backend/supabase/functions/submit-recovery-operation/index.ts`
- `docs/plans/email-recovery-polish.md` — step 2.3 (edge function extension)
