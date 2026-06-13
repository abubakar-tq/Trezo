# Recovery Attempt is initiated only from a new device in production; same-device "Start Email Recovery" is testing-only and ships behind `__DEV__`

**Status:** accepted
**Date:** 2026-05-29

## Decision

In production, a Recovery Attempt (CONTEXT.md) is initiated from the **unauthenticated welcome screen of a new device** that does not hold a passkey for the target smart account. The user lands on that screen, selects "Recover account via email," supplies their guardian emails, and waits while the flow installs a fresh passkey on the new device.

The current "Start Email Recovery" affordance on `EmailRecoveryScreen` — which initiates recovery *from a device that already holds a working passkey for the same account* — is reclassified as a **testing-only affordance**. It is retained for v1 dev cycles (and remains the path being polished in the v1 polish work), but it ships behind a `__DEV__` gate and is removed from production builds.

The production new-device entry surface is **out of scope for v1 polish**. It will be built when the v1 polish is shipped and stable.

## Why

The same-device flow as a user-facing affordance is paradoxical: you already have a working passkey on this device, so why would you rotate to a new one? Real reasons to rotate (lost device, compromised credential) are inherently *not-this-device* events. Surfacing "Start Recovery" on a working device:

- Invites accidental rotation by users who tap to see what the button does
- Has no natural "abort" gesture once the on-chain vote lands and the 49-hour window starts ticking
- Adds a meaningful permission complexity (the user is essentially asking the same account to authorize its own takeover) that a production audit would have to defend

For testing, however, the same-device flow is invaluable: it lets a developer exercise the full recovery loop on a single phone, observe state transitions in Metro, and snapshot the result in seconds. Removing it would force every test cycle to involve two physical devices and a coordinated dance — a real productivity tax for marginal correctness gains.

Keeping the testing affordance behind `__DEV__` resolves the tension: production builds don't ship it, dev builds still have it.

The new-device entry — a separate screen reachable from app launch before any passkey is detected — is a meaningful new piece of UI that needs its own design pass. Bundling it into v1 polish would either ship something half-baked or delay the polish. Pushing it to v2 is the honest scoping decision.

## Implications for v1 polish

- Auto-execute (the fire-and-forget completion behavior decided during the grilling session) targets the new-device case, but is implemented and tested via the same-device dev flow. Same code path, same correctness guarantees.
- The "Recovery Attempt in progress" banner (Home + Profile) is primarily useful in the testing flow, where the user has a working passkey and other parts of the app to navigate to. In the production new-device flow, the user has nothing else they *can* navigate to until recovery completes — the banner is redundant. We still ship it because the testing flow needs it and it costs nothing in production.
- The Resume sheet (Q6 of the grilling) is needed in both flows: in dev to prevent the row-pollution bug that bit us during testing; in production to handle the case where a user opens the new-device app, backgrounds it mid-flow, and reopens later.
- Auto-cancel-expired (ADR-0010) is needed in both flows but only fires in production. In dev the user can also just clear it manually.

## Considered alternatives

- **Build the production new-device flow as part of v1 polish**: rejected. New unauthenticated welcome screen, new entry UX, new error paths for "guardian email not recognized" — large scope, easy to ship half-done, delays the high-leverage polish.
- **Remove the same-device flow from v1 entirely and force two-device testing**: rejected. Doubles test-cycle latency and complexity; no real correctness gain because the underlying mechanics are identical.
- **Keep same-device in production but behind a "I know what I'm doing" warning modal**: rejected. Modals are training-wheels; they don't stop accidents in production telemetry. The right answer is "don't ship the flow."

## Consequences

### Code

- `EmailRecoveryScreen.handleInstallModule` and the "Start Email Recovery" CTA on that screen are wrapped in a `__DEV__` check.
- The same applies to `EmailRecoveryStartScreen` and the navigation entry that reaches it.
- The Dev Controls "Restore passkey from on-chain" card stays `__DEV__`-only (it solves a class of bug that real users should not encounter after polish ships).

### Out of scope for v1 polish

- The unauthenticated production welcome screen ("Recover account via email" CTA)
- The flow that lets a user enter their guardian email address from scratch, then identify their smart account address by deriving it from the guardian's relationship
- Cross-device coordination ("send a link to your old device") — out of scope; ZK Email recovery does not need it because guardians are the proof of identity

These are noted here so the v2 backlog has a single place to anchor.

### Documentation

CONTEXT.md's "Recovery Attempt — entry point semantics" entry codifies the production vs testing distinction so future contributors don't accidentally restore the same-device flow.

## Related

- CONTEXT.md → "Recovery Attempt — entry point semantics", "Wallet compromise (action)"
- ADR-0009 — on-chain source of truth (applies to both flows)
- ADR-0010 — cancel-expired EOA (motivated by the new-device path)
- `docs/plans/email-recovery-polish.md` — scope boundary
- `apps/mobile/src/features/profile/screens/EmailRecoveryScreen.tsx` (same-device flow, dev-gated)
- `apps/mobile/src/features/profile/screens/EmailRecoveryStartScreen.tsx` (same-device flow, dev-gated)
