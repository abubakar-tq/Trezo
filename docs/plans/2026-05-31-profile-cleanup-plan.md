# Profile Ecosystem Cleanup — Implementation Plan (Stream A)

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or executing-plans. Steps use checkbox (`- [ ]`) tracking.
>
> **READ FIRST:** `docs/plans/2026-05-31-profile-cleanup-spec.md` (this plan's source of truth) and `docs/plans/2026-05-30-mobile-redesign-spec.md` (global design system — tokens, radius scale, restraint principle).

**Goal:** Reduce the Profile ecosystem from ~31 to ~15 live screens — delete dead screens, gate dev/test UI, split the EmailRecovery monolith by state, build a Recovery & Backup hub, trim Devices, surface remove-guardian, restore plain language — without changing any on-chain recovery logic.

**Architecture:** Independent of Stream B (core screens). Can run in its own worktree in parallel. Touches `src/features/profile/`, `src/features/recovery/`, `src/app/navigation/RootNavigation.tsx`, `src/types/navigation.ts`.

**Tech stack:** Expo SDK 54, RN 0.81.5, React 19, TypeScript, React Navigation native-stack.

---

## CRITICAL CONSTRAINTS (read before any task)

1. **Worktree / npm install:** worktrees under `D:\trezo` resolve `node_modules` upward to root. **NEVER `npm install` in the worktree.** (Stream A adds no new deps, so this shouldn't arise.)
2. **No jest.** Tests are plain `tsx` scripts, relative imports only, pure (no-RN-import) logic modules with sibling `__tests__`, registered in `apps/mobile/package.json` `test:dapp`. Reference: `src/features/browser/utils/backAction.ts`.
3. **Never `--no-verify`. Never add `Co-Authored-By: Claude`.**
4. **SAFETY — do not change on-chain recovery logic.** This is light-clean: nav restructure, screen split by state, dev-gating, surfacing existing actions, relabeling. The module install / guardian set / threshold / timelock / UserOp building stays byte-for-byte. Plain-language labels wrap the SAME params (e.g. "48h delay" → the same delay seconds; weights still passed as `1`).
5. **Restraint principle (anti-slop):** color = signal not decoration; healthy = calm/near-monochrome (faint violet icon chips, soft-glow active dots); amber ONLY on needs-action. Profile-scoped — don't touch core screens.
6. **After each task:** `cd apps/mobile && npx tsc --noEmit` (no new errors in touched files) and `npm run test:dapp` (green); commit with a clear message.
7. **Order:** deletes + nav first (Task 1) so the tree is clean, then build up.

---

## Task 1: Delete the 3 dead screens + clean navigation
**Files:** delete `src/features/profile/screens/ConnectedDevicesScreen.tsx`, `src/features/profile/screens/SecurityPrivacyScreen.tsx`, the whole `src/features/settings/` dir; edit `src/app/navigation/RootNavigation.tsx`, `src/types/navigation.ts`.

- [ ] **Step 1** — Delete the 3 files (+ `src/features/settings/screens/index.ts` and dir).
- [ ] **Step 2** — In `RootNavigation.tsx` remove imports (lines 15 ConnectedDevices, 28 SecurityPrivacy, 39 Settings) and the `<Stack.Screen>` blocks (`SecurityPrivacy` 375-382, `ConnectedDevices` 383-390, `Settings` 443-447).
- [ ] **Step 3** — In `src/types/navigation.ts` remove the route entries (`SecurityPrivacy` 69, `ConnectedDevices` 70, `Settings` 73).
- [ ] **Step 4** — `npx tsc --noEmit`: confirm zero references remain (the recon verified none exist; this proves it). Commit: `refactor(profile): delete dead ConnectedDevices/SecurityPrivacy/legacy Settings screens`.

## Task 2: Gate GuardianRecovery dev/test UI behind `__DEV__`
**Files:** `src/features/profile/screens/GuardianRecoveryScreen.tsx`.

- [ ] **Step 1** — Wrap the timelock picker UI (917-948) in `{__DEV__ && (...)}`.
- [ ] **Step 2** — Wrap the debug rows in `{__DEV__ && (...)}`: `lastUserOpHash` (882-887), `lastOperationHash` (888-893), `lastInstallPayload` box (894-916).
- [ ] **Step 3** — Ensure production install path uses the fixed `86400` timelock when the picker is hidden — the code already falls back to `?? 86400` (line ~381); confirm `selectedTimelockIdx` defaulting to index 3 (=1 day) still holds, so non-dev builds install 1-day timelock. Do NOT change the install call shape.
- [ ] **Step 4** — `tsc` clean; commit: `chore(recovery): gate guardian timelock picker + payload debug behind __DEV__`.

## Task 3: Email Recovery — split by state into Setup vs Manage
**Files:** `src/features/profile/screens/EmailRecoveryScreen.tsx` (2263 lines). Prefer extracting two child components (`EmailRecoverySetup`, `EmailRecoveryManage`) in the same feature folder, with `EmailRecoveryScreen` switching on `moduleInstalledState`.

- [ ] **Step 1 — extract pure label helpers + test.** Create `src/features/profile/utils/recoveryLabels.ts` (no RN imports) mapping params to plain language, e.g.:
```ts
export function delayLabel(seconds: number): string {
  const map: Record<number, string> = { 86400: "24 hours", 172800: "48 hours", 604800: "7 days" };
  return map[seconds] ?? `${Math.round(seconds / 3600)} hours`;
}
export const DELAY_CHOICES = [
  { seconds: 86400, label: "24 hours", note: "" },
  { seconds: 172800, label: "48 hours", note: "Recommended" },
  { seconds: 604800, label: "7 days", note: "Most cautious" },
];
export function approvalsSummary(threshold: number, total: number): string {
  return `${threshold} of ${total} approvals`;
}
```
  Add `__tests__/recoveryLabels.test.ts` (tsx, relative import, hand-rolled asserts) covering `delayLabel` (known + fallback) and `approvalsSummary`. Register in `test:dapp`.
- [ ] **Step 2 — Setup wizard** (rendered when `!moduleInstalledState`): 3 steps — intro → trusted contacts (email add/remove) → approvals (threshold stepper) + safety delay (`DELAY_CHOICES`). Install CTA "Turn on Email Recovery". **Weights NOT shown** — keep `parseGuardianWeights()` supplying `1` per contact to `buildInstallModuleUserOp` (unchanged).
- [ ] **Step 3 — Manage** (rendered when `moduleInstalledState`): on-state summary; trusted-contacts list with accepted/pending(resend) + **Remove per contact** (use existing remove handler); Settings rows "Approvals & timing" and **"Advanced · per-contact weights"** (relocate the existing weight UI 1492-1501 behind this Advanced route, default equal); Turn off (danger).
- [ ] **Step 4 — delete dead UI.** Remove the `SHOW_ADVANCED_RECOVERY_UI`-gated blocks entirely (1272-1431, 1521-1535, 1600-1644, 1665-1722) and the constant (41). Keep all on-chain handlers.
- [ ] **Step 5** — `tsc` clean; `test:dapp` green; device-verify both states (fresh wallet → Setup; installed → Manage). Commit: `refactor(email-recovery): split monolith into Setup wizard + Manage; weights behind Advanced; plain-language labels`.

## Task 4: Recovery & Backup hub
**Files:** repurpose `src/features/profile/screens/BackupRecoveryScreen.tsx` into the hub (keep the route name `BackupRecovery` so existing links work, or rename to `RecoveryHub` + update refs — prefer keeping the name to minimize churn).

- [ ] **Step 1** — Summary at top: an inline 3-segment bar driven by real method states (guardians on? email on? linked-devices always on) + a calm headline. (Use `RecoveryScoreWidget` only if you wire it to real state; otherwise inline — don't ship the widget's static illustrative breakdown as if real.)
- [ ] **Step 2** — Methods list: Guardians → `GuardianRecovery`; Email Recovery → `EmailRecovery`; **Linked Devices → `DevicesPasskeys`** (cross-link, not a new screen). Status = grey dot (on) / amber "Set up" (off). No green pills.
- [ ] **Step 3** — Activity: Recovery Status → `RecoveryAttemptStatus`; Incoming Approvals → `IncomingRecoveryApprovals` (badge count).
- [ ] **Step 4** — `tsc` clean; device-verify healthy + needs-action states; commit: `feat(profile): Recovery & Backup hub (flattens 4-tap recovery nesting)`.

## Task 5: Recovery status merge
**Files:** `src/features/profile/screens/RecoveryAttemptStatusScreen.tsx`, `EmailRecoveryGroupStatusScreen.tsx`.

- [ ] **Step 1** — Present group-status content as a section/accordion within RecoveryAttemptStatus so it's not a separate 4th-level push. If GroupStatus is reached only from AttemptStatus, inline it and drop the extra navigation; keep the file only if other code references it (`tsc` will tell).
- [ ] **Step 2** — `tsc` clean; commit: `refactor(recovery): merge group status into attempt status (one fewer hop)`.

## Task 6: Profile root regroup
**Files:** `src/features/profile/screens/ProfileScreen.tsx`.

- [ ] **Step 1** — Restructure `settingsGroups` (202-233) into **Security / Wallet / Preferences** per spec §2. Security: Recovery & Backup (+ quiet status), Devices & Passkeys. Wallet: Connected Apps, Contacts. Preferences: Notifications, Browser, Dev Controls (`__DEV__`).
- [ ] **Step 2** — Apply the restraint styling: Feather icons as faint violet-tinted chips; status as a quiet grey dot (healthy). Keep the existing inline row pattern. Footer card: compromised + sign out + version.
- [ ] **Step 3** — `tsc` clean; device-verify; commit: `feat(profile): regroup root into Security/Wallet/Preferences with restrained styling`.

## Task 7: Devices trim
**Files:** `src/features/profile/screens/DevicesPasskeysScreen.tsx`.

- [ ] **Step 1** — Render the "Pending Requests" card (723) only when non-empty.
- [ ] **Step 2** — Tidy into Add / My Passkeys / Wallet Devices sections per spec §5 (keep all handlers: add/register/remove passkey, remove/cancel/finalize device + timelock). No logic change.
- [ ] **Step 3** — `tsc` clean; device-verify; commit: `refactor(profile): trim Devices & Passkeys (hide empty pending, clean sections)`.

## Task 8: Compromised wallet + Browser Settings
**Files:** `src/features/profile/screens/CompromisedWalletScreen.tsx`, `BrowserSettingsScreen.tsx`.

- [ ] **Step 1 — Compromised:** slim to icon + "Secure your wallet" + one-line reassurance + primary "Start recovery now" + secondary "Review my recovery setup" + 3-step "What happens". Remove the technical "What Level 2 does" block. Keep the nav targets (GuardianRecovery / EmailRecovery).
- [ ] **Step 2 — Browser Settings:** replace all sci-fi copy with plain labels (Tabs/Search/Privacy; "Close tabs after", "Search engine", "History limit", "Block pop-ups", "Clear browsing data"). Wire the dead "Clear All" `onPress={() => {}}` to a real clear, or remove it. No dead buttons.
- [ ] **Step 3** — `tsc` clean; device-verify; commit: `refactor(profile): slim compromised-wallet screen + plain-language Browser Settings`.

## Task 9: Final pass
- [ ] Grep for any remaining refs to deleted routes; `tsc --noEmit` clean across touched files; `npm run test:dapp` green.
- [ ] Verify the recovery flows still work end-to-end on testnet (install email recovery, add/remove guardian) — the on-chain paths must be unchanged. Commit any cleanup.

## Self-review checklist (before handoff back)
- [ ] 3 dead screens gone; no dangling nav refs (`tsc` clean).
- [ ] Dev/test UI (timelock picker, payload dumps) not visible in a production build.
- [ ] EmailRecovery shows Setup when not installed, Manage when installed; remove-guardian present; weights behind Advanced; no `SHOW_ADVANCED_RECOVERY_UI` dead cards shipped.
- [ ] Recovery reachable in ≤2 taps via the hub; Linked Devices cross-links to the one Devices screen.
- [ ] On-chain recovery logic unchanged (install/guardian/threshold/timelock/UserOp identical).
- [ ] Healthy Profile reads calm (no color spray); amber only on needs-action.
- [ ] Browser Settings plain language; no dead buttons.
