# Recovery & Device-Linking Correctness + Polish Pass

**Date:** 2026-06-02
**Branch:** `feat/mobile-polish-pass`
**Status:** spec — approved scope, ready for implementation plan

## Background

A multi-agent investigation (26 agents, adversarial verification) confirmed **21 findings** (1
rejected) across the device-linking and account-recovery flows in `apps/mobile`. Two were
user-reported; the rest were surfaced and verified during the sweep. The device-linking entry
regressed when commit `87d7a768f` (2026-05-12, "move device pairing entry into Security Center")
removed the sign-in entry point and relocated the QR scanner into Profile, which a new device
cannot reach after sign-in.

This pass restores a working new-device linking flow, hardens recovery navigation guards, fixes
recovery liveness/state correctness bugs, surfaces the (already-live on Base Sepolia) email-recovery
new-device entry, and applies targeted design-consistency fixes.

## Product decisions (locked with owner)

1. **Email recovery is a live feature on Base Sepolia** (ADR-0006). Surface the existing
   production new-device email entry — do not treat it as absent. The same-device test path and the
   `forceNewPasskey` toggle stay `__DEV__`-only.
2. **Device-linking entry point lives on the wallet's "activate passkey" prompt, not sign-in.**
   When a device has no passkey, the wallet shows an "Enable Passkey" prompt; tapping it leads to an
   options screen (`RecoveryEntry`) that must offer **"Link a new passkey"** → opens the QR-scan /
   pairing screen (`LinkDevice`). The pairing screens themselves stay in Profile › Linked Devices.
   **Do not** add a QR-scan entry directly on the sign-in screen.
3. **Design cleanup is targeted**, not a structural refactor (no shared `ScreenHeader`, no
   ceremonial gold/serif decision, no repo-wide sweeps).
4. **Recovery liveness fixed client-side now**; the missing backend stale-row cleanup job is a
   logged follow-up.

## New-device journey (target)

Existing user, deployed wallet on Device A, signs in on new Device B with the same social login:

1. Device B sign-in → Home/wallet (`hasLocalPasskey=false`, deployed) → BalanceCard shows
   **"Enable Passkey"**. (Cold-start equivalent: `RootNavigation` routes deployed-no-passkey to
   `RecoveryEntry` directly.)
2. Tap "Enable Passkey" → `RecoveryEntry` (`no_passkey` state) showing options:
   **"Link a new passkey"** (prominent), plus "Recover with Guardians" / "Recover with Email".
3. "Link a new passkey" → `LinkDevice` (QR scanner / paste link).
4. Device A: Profile › Linked Devices → "Add a Device" generates the QR/link.
5. Device B scans/pastes → `PairDevice` consumes link → Device A approves → Device B receives passkey.

Alternative inbound path (the "or link" half): tapping a `trezowallet://pair-device` deep link must
be handled and routed into the same `PairDevice` (signed-in) / `Login{pairingMode:"resume"}`
(signed-out) flow.

## Workstreams

### WS1 — Restore device linking (critical)

- **`RecoveryEntryScreen`** (`no_passkey` state): reframe the device-link affordance as
  **"Link a new passkey"** and route it to `navigate("LinkDevice")` (the scanner) instead of
  `PairDevice` (the consumer). Make it a prominent option alongside the guardian/email recovery
  choices. *(file: `features/recovery/screens/RecoveryEntryScreen.tsx:~227-234`)*
- **`PairDeviceScreen`** empty state ("No pairing link found"): change the only action from
  `goBack()` to `navigate("LinkDevice")` ("Scan pairing QR"). *(`features/profile/screens/PairDeviceScreen.tsx:~223-234`)*
- **Deep-link handler:** add `useDevicePairingDeepLink` mounted in `RootNavigation` that, on
  `getInitialURL()` + `'url'` events, runs `DevicePairingService.parsePairingDeepLink`, and on a
  match `stashPendingDeepLink` then routes to `PairDevice` (logged in) or `Login{pairingMode:"resume"}`
  (logged out). Kept separate from the OAuth `handleAuthRedirect`. *(new hook; `app/navigation/RootNavigation.tsx`)*
- **`DevicesPasskeysScreen`** (Profile, kept as the home of pairing): pass
  `expectedPasskeyId: aaAccount?.ownerAddress` into `getWalletSignerStatus` so `canSignForWallet`
  reflects whether the *local* passkey matches the wallet owner (matches sibling recovery screens),
  ensuring genuine new devices see the inbound "Pair this device" scanner entry rather than the
  outbound "Add a Device" generator. *(`features/profile/screens/DevicesPasskeysScreen.tsx:~134-138`)*
- **Copy:** reuse/clean up the orphaned `LABELS.linkADevice`; ensure "Link this device" (act on this
  device) vs "Add a device" (provision another) wording is semantically correct.
- **Not doing:** pre-auth sign-in QR entry (owner decision); `LocalSignerService` default-permissive
  hardening (security-sensitive — deferred, see below).

### WS2 — Guardian recovery navigation guards (high) — user bug #2

- Add a shared helper `resolveGuardianRecoveryTarget({ userId, smartAccountAddress, chainId, expectedPasskeyId })`
  that checks **on-chain signer authority** (`LocalSignerService.getWalletSignerStatus` →
  `canSignForWallet`) and `SocialRecoveryService.isModuleInstalled`.
- **`RecoveryEntryScreen`**: replace the local-only `Boolean(passkey?.credentialIdRaw)`
  discrimination with the authority signal; source `smartAccountAddress`/`chainId` from the wallet
  store as `GuardianRecoveryScreen` does. Only navigate to `GuardianRecovery` when authoritative
  **and** guardians configured; otherwise show an inline explanation / route to the recovery path.
  *(`RecoveryEntryScreen.tsx:~81-96, ~180-201`)*
- **`CompromisedWalletScreen.handleGuardianStart`**: use the same helper instead of the local-passkey
  branch. *(`features/profile/screens/CompromisedWalletScreen.tsx:~24-37`)*
- **`GuardianRecoveryScreen`**: type the `navigation` prop (drop `as never`); blocked-state CTA uses
  `canGoBack() ? goBack() : navigate("RecoveryEntry", { reason })` to kill the loop and preserve the
  param. *(`features/profile/screens/GuardianRecoveryScreen.tsx:~48, ~481-487`)*

### WS3 — Recovery liveness, client-side (high)

- **`RecoveryRequestService.getLatestActiveRecoveryRequestForUser`**: add a deadline guard so a
  past-deadline request is not returned as active (fixes the "Resume Recovery" mislead on
  `RecoveryEntry` and `BackupRecovery`). *(`features/wallet/services/RecoveryRequestService.ts:~317-319`)*
- **`useActiveRecoveryAttemptId`**: the `deadline` column was dropped; add a `created_at`-age
  liveness predicate (the documented pre-vote TTL) so expired attempts stop pinning the resume sheet
  **and** the sticky `RecoveryAttemptBanner`. *(`features/wallet/hooks/useActiveRecoveryAttemptId.ts:~25-32`)*
- **Resume sheet backstop**: for a past-TTL attempt, present "Start new" / auto-cancel rather than
  "Continue". *(`features/profile/screens/RecoveryAttemptResumeSheet.tsx`)*
- **Deferred follow-up:** build the missing stale-row cleanup (cron / edge fn that sets `deleted_at`
  on expired pre-vote `email_recovery_groups`). Logged, not in this pass.

### WS4 — Surface production email-recovery new-device entry (medium)

- **`RootNavigation`**: register `EmailRecoveryStart` unconditionally (remove the `__DEV__ &&`
  wrapper). *(`app/navigation/RootNavigation.tsx:~245-255`)*
- **`RecoveryEntryScreen`** (`no_passkey`): route "Recover with Email" →
  `navigate("EmailRecoveryStart")` (the initiator) instead of `EmailRecovery` (the manager that
  blocks no-passkey devices). *(`RecoveryEntryScreen.tsx:~221`)*
- **`EmailRecoveryScreen`** blocked card: stop re-navigating to `RecoveryEntry` (breaks the visible
  loop). *(`EmailRecoveryScreen.tsx:~1077`)*
- Keep `forceNewPasskey` toggle and the `EmailRecoveryManage` same-device shortcut `__DEV__`-only.
- **`EmailRecoveryStartScreen`** correctness (now production-relevant): add `resolvedChainId` +
  `forceNewPasskey` to the `handleCreateAndSend` `useCallback` deps; check the cancel-expired invoke
  result (`data.status === "cleared" | "no-op"` vs `"failed"` at HTTP 200) before calling
  `createGroup`. *(`EmailRecoveryStartScreen.tsx:~150-153, ~194`)*
- **ADR:** log an update to ADR-0011 — the production new-device email-recovery entry (previously
  "v2 scope") is now shipped on Base Sepolia; same-device path remains testing-only.

### WS5 — Targeted design fixes

- **DESIGN-1 (the big one):** standardize primary CTAs to violet `colors.accent` (the design-system
  primary; cyan `accentAlt` is reserved for outbound/value-departure). Change the cyan primary
  buttons: `DevicesPasskeysScreen` (Pair/Add), `LinkDeviceScreen` (Continue), `PairDeviceScreen`
  (primary), `EmailRecoveryScreen` (install), `EmailRecoverySetup` (Turn on Email Recovery),
  `RecoveryAttemptResumeSheet` (Continue) + retint paired decorative borders.
- **DESIGN-4:** upgrade `PairDeviceScreen`'s header to the shared glass back-button + kicker/title
  used by its two siblings (inline, not a new component); remove the literal `` `addPasskey` ``
  backtick from user-facing copy. *(`PairDeviceScreen.tsx:~200-206, ~287`)*
- **DESIGN-2:** `#fff` → `colors.textOnAccent` in `RecoveryAttemptResumeSheet.tsx:114` and
  `RecoveryAttemptStatusScreen.tsx:337-338` (no conditional-render change needed).
- **DESIGN-3:** raw `fontFamily:"monospace"` → `FontFamilies.mono` on the recovery/guardian screens
  (`GuardianRecoveryScreen` 7 occurrences incl. payload/hash rows; `RecoveryAttemptStatusScreen:428`).
- **Not doing (owner scope):** shared `ScreenHeader` (DESIGN-5), ceremonial gold/serif decision
  (DESIGN-6), repo-wide monospace sweep.

## Explicitly deferred (flagged, not silent)

- Backend stale-row cleanup cron/edge fn for expired `email_recovery_groups` (WS3 follow-up).
- `LocalSignerService` over-permissive `canSignForWallet=true` defaults for undeployed-wallet and
  RPC-error states (security-sensitive; needs isolated testing).
- App-wide `monospace`/header-metric inconsistencies outside this section.

## Testing

Per repo convention (`apps/mobile` has no jest; tests are plain `tsx` scripts run with `npx tsx`,
native-importing modules need DI):

- **Pure logic, unit-tested:** `getLatestActiveRecoveryRequestForUser` deadline guard;
  `useActiveRecoveryAttemptId` liveness predicate (extract a pure `isAttemptLive(createdAt, now)`);
  `resolveGuardianRecoveryTarget` decision table (DI the signer-status + module-installed lookups).
- **Navigation/UI:** verified by running the app on the owner's Android device (run-mobile skill) —
  the new-device link journey, the guardian-guard no-op, and the email entry, plus a visual pass on
  the CTA color standardization.

## Touch-point coordination

`RecoveryEntryScreen` is edited by WS1 (link route), WS2 (guard logic), and WS4 (email route) — these
must be sequenced as coordinated edits on one branch, not parallelized.
