# Profile Ecosystem Cleanup — Design Spec (Stream A)

> Status: **LOCKED** (2026-05-31). Validated screen-by-screen with the user via browser mockups.
> Companion spec: `docs/plans/2026-05-30-mobile-redesign-spec.md` (the global design system — tokens, type ramp, radius scale, governance). This spec inherits all of it.

## 0. Goal & Governance

**Goal:** subtraction. Take the Profile ecosystem from **~31 reachable/registered screens → ~15 live**, with the same capabilities — by deleting dead screens, gating dev/test UI, merging redundant ones, and flattening recovery nesting.

**Direction:** same B+A+C model as the core redesign. Profile is mostly **GOVERNOR (A) — restraint**.

**CRITICAL design principle (the user flagged AI-slop drift):**
> **Color = signal, not decoration.** The healthy state is calm and near-monochrome — muted text, faint violet-tinted icon chips (≈7% accent bg), a soft glow on active-status dots. **Loud color (amber) appears ONLY when something needs action.** A fully-set-up wallet's Profile should look quiet and confident, never a field of green "Active" pills. This restraint is **Profile-scoped** for this pass; do not restyle the already-locked core screens.

**Hard safety rule (recovery/email/guardian):** This is **light-clean** on those flows — restructure navigation, split screens by state, gate dev UI, surface existing actions (remove-guardian), relabel in plain language. **Do NOT change the on-chain logic** (module install, guardian set, threshold, timelock, UserOp building). Plain-language labels wrap the same contract params.

## 1. The 8 cuts (how ~31 → ~15)

### DELETE ×3 (recon-confirmed orphaned — zero live nav refs)
- **ConnectedDevices** — `src/features/profile/screens/ConnectedDevicesScreen.tsx` (mock; hardcoded device array, no-op buttons). No `navigate("ConnectedDevices")` anywhere.
- **Legacy Settings** — `src/features/settings/screens/SettingsScreen.tsx` (+ the whole `src/features/settings/` dir incl. `screens/index.ts`). Disconnected duplicate; props never passed; all buttons `onPress={() => {}}`. No `navigate("Settings")` anywhere.
- **SecurityPrivacy** — `src/features/profile/screens/SecurityPrivacyScreen.tsx` (pure passthrough to DevicesPasskeys + BackupRecovery, both already reachable in 1 tap from root). No `navigate("SecurityPrivacy")` anywhere.

### GATE ×3 behind `__DEV__` (currently rendering in production)
- **GuardianRecoveryScreen** timelock picker (`TIMELOCK_OPTIONS` lines 37-43; picker UI 917-948 "Timelock (testing only)") and the raw debug rows: `lastUserOpHash` (882-887), `lastOperationHash` (888-893), `lastInstallPayload` "Latest Module Payload" box (894-916). Wrap all in `__DEV__`; in production the install must use the fixed `86400` (1 day) timelock (the code already falls back to `86400`).
- **EmailRecoveryStart** — already `__DEV__`-gated (RootNavigation 249-259; entry in EmailRecoveryScreen 1820-1829). No change; just preserve the gate through the split.
- **Check Passkey Authority** (ProfileScreen 326-349) — already `__DEV__`-gated. Keep.

### MERGE ×2
- **EmailRecovery monolith** (`EmailRecoveryScreen.tsx`, 2263 lines) → split by `moduleInstalledState` into **Setup wizard** (not installed) and **Manage** (installed). See §3.
- **Recovery status screens** — `RecoveryAttemptStatusScreen` + `EmailRecoveryGroupStatusScreen` → present group status as a section/accordion within the attempt-status screen (one fewer hop). (Keep both files if low-risk; the win is the nav flattening — Group Status no longer a separate 4th-level push.)

## 2. New IA — Profile root (`ProfileScreen.tsx`)

Hero (avatar → Edit Profile; tap row or avatar) + theme toggle. Then three groups (was ACCOUNT / PREFERENCES):

- **Security**
  - Recovery & Backup → the new hub (§2.1) — with a quiet status indicator (grey dot when healthy)
  - Devices & Passkeys → `DevicesPasskeys` (with "N devices" meta)
- **Wallet**
  - Connected Apps → `ConnectedDApps`
  - Contacts → `ContactList`
- **Preferences**
  - Notifications → `NotificationSettings`
  - Browser → `BrowserSettings`
  - Dev Controls → `DevCreateAccount` (`__DEV__` only — keep)
- **Footer card:** My wallet is compromised (danger) → `CompromisedWallet`; Sign out; version.

Icons: **Feather line** (1.5px, single color), rendered as faint violet-tinted chips per the restraint principle. Rows: reuse ProfileScreen's existing inline row pattern (lines ~301-320) — no shared Row component exists; keep it inline but consistent.

### 2.1 Recovery & Backup hub (replaces `BackupRecoveryScreen` as the single entry)
A new hub screen holding everything recovery, ≤2 taps to anything:
- **Summary** at top: a calm "fully recoverable" line + a single-accent segment bar (N of 3 methods). Reuse `RecoveryScoreWidget` (`src/shared/components/Tier3/RecoveryScoreWidget.tsx`, `compact` prop) IF its breakdown can be wired to real state; otherwise a simple inline 3-segment bar (the widget's breakdown is currently static/illustrative — prefer the inline bar driven by real method states for honesty).
- **Methods** (3, always listed):
  1. **Guardians** → GuardianRecovery (cleaned) — on/off status
  2. **Email Recovery** → EmailRecovery (split) — on/off status
  3. **Linked Devices** → **cross-links to the SAME `DevicesPasskeys` screen** (NOT a duplicate manager). This is the always-on 3rd method (you can always recover from a paired device), which is why "3 of 3" is honest.
- **Activity:**
  - Recovery Status → RecoveryAttemptStatus (with group status merged in)
  - Incoming Approvals → IncomingRecoveryApprovals (guardian inbox; "N" badge)

Status colors: grey dot = on/healthy; **amber** "Set up" only for a method that's off. No green pills.

## 3. Email Recovery split (`EmailRecoveryScreen.tsx`)

Branch on `moduleInstalledState` (state line 106, from `EmailRecoveryService.isModuleInstalled`). Keep the early "this device can't manage recovery" gate (1181-1231) for both.

### Setup (not installed) — a focused wizard, plain language
3 steps, one decision per screen:
1. **Intro/passkey** (existing intro copy 1267-1270).
2. **Trusted contacts** — add emails (the guardian email list). "Who can help you recover?" Recommend ≥3. Each addable/removable.
3. **Approvals & timing** — "How many must approve?" as a stepper (the threshold, today lines 1433-1536 region); "Safety delay" as **named choices** (24h / 48h Recommended / 7 days) wrapping the delay param (1538-1562). Install CTA = "Turn on Email Recovery" (the install path 1564-1722).
- **Per-contact weights: NOT shown in setup.** Default every contact to weight `1`. `parseGuardianWeights()` (816-826) still supplies weights to `buildInstallModuleUserOp({ weights })` (983) — just always `1`.

### Manage (installed) — calm status
- On-state summary ("Email Recovery is on · 2 of 3 approvals · 48h delay").
- **Trusted contacts** list: accepted / invite-sent (resend), and a **Remove** action per contact (surface the existing remove-guardian path; recon confirms add/remove handlers exist in the installed section 1724-1832).
- **Settings:** "Approvals & timing" row (edit threshold/delay); **"Advanced · per-contact weights"** row (your call) — weights live here behind Advanced, default equal, for power users. (Reuse the existing weight state/handlers 88-153, 802-809; just relocate the UI behind Advanced instead of per-row.)
- Turn off Email Recovery (danger).
- **Drop** the `SHOW_ADVANCED_RECOVERY_UI = false` dead cards entirely (1272-1431, 1521-1535, 1600-1644, 1665-1722) rather than ship hidden dead code.

## 4. Guardians (`GuardianRecoveryScreen.tsx`) — cleaned

- Keep: on-state summary, guardian list, **add guardian**, **remove guardian** (surface existing path), threshold setting, the "Social Recovery Module" install/update.
- **Gate behind `__DEV__`:** the timelock picker (917-948) and the payload/UserOp debug rows (882-916) — see §1. Production uses fixed `86400` timelock.
- Plain-language: "Threshold" row → "2 of 3 must approve"; keep a short "24-hour safety delay applies" note.

## 5. Devices & Passkeys (`DevicesPasskeysScreen.tsx`, 1272 lines) — trimmed

Keep the two logical sections, trim the chrome:
- **Add a device** (QR pair) — one entry.
- **My Passkeys** (775+) — list with register-on-chain / remove.
- **Wallet Devices** (856+) — paired devices, active / pending-removal (timelock), Remove/Cancel/Finalize.
- **"Pending Requests"** card (723) — render **only when non-empty** (today it always shows "No pending…").
- This is the cross-link target for the hub's "Linked Devices" method.

## 6. Compromised wallet (`CompromisedWalletScreen.tsx`) — slimmed
Crisis screen: icon + "Secure your wallet" + ONE line of plain reassurance + **one primary** ("Start recovery now") + one secondary ("Review my recovery setup") + a 3-step "What happens" (guardians approve → safety delay → new key). Remove the technical "What Level 2 does" body block.

## 7. Browser Settings (`BrowserSettingsScreen.tsx`) — tone fix
- Replace sci-fi copy ("GALACTIC CONFIGURATION", "TAB QUANTUM STATE", "NAVIGATION ENGINE", "Purge History / journey logs") with plain labels: Tabs / Search / Privacy; "Close tabs after", "Search engine", "History limit", "Block pop-ups", "Clear browsing data".
- The dead **"Clear All Browsing Data"** `onPress={() => {}}` → wire to a real clear, or remove the row. No dead buttons.

## 8. Out of scope (this pass)
Low-change screens left as-is unless trivially touched: Edit Profile, Notifications, Contacts (+Add/Detail), Connected Apps, PairDevice/LinkDevice. The 9 recovery-feature screens (`src/features/recovery/screens/*`) stay reachable; only their entry nesting flattens under the hub.
