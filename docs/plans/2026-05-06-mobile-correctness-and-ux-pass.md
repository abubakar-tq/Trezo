# Mobile Correctness & UX Polish Pass — Design

**Date:** 2026-05-06
**Status:** Approved (pre-implementation)
**Scope:** Six issues across home balance, recent activity, recovery routing, passkey persistence, and DEX/swap UX. One spec, three workstreams. No architectural overlap between workstreams; can be implemented in parallel.

---

## Goal

Bring the mobile wallet up to a release-ready quality bar by fixing six concrete issues:

1. Home balance reflects real on-chain native + ERC-20 holdings, not a hardcoded USD multiplier.
2. Failed transactions in Recent Activity no longer display a misleading negative amount.
3. Users with no local passkey on their device are routed to recovery instead of stuck on the biometric prompt.
4. The Supabase `passkeys` table is populated automatically when a wallet is deployed, including a lazy backfill for existing accounts.
5. Transaction Status and Detail screens have a clear back/exit affordance instead of requiring repeated swipe-back gestures.
6. Swap errors are classified, surfaced with appropriate severity, and guarded against common transient failures (RPC drops, stale quotes, user rejection).

## Non-goals

- On-chain pre-flight simulation of swap user-ops (deferred — separate focused pass).
- Refactor of the recovery flows themselves (Guardian, Email) — only the routing into them.
- Multi-device passkey sync UI (already implemented in `DevicesPasskeysScreen`; this spec only ensures that screen has data to show).
- Production price oracles, indexed token discovery via Ponder, or chain expansion beyond what's already supported.
- Refactor of unrelated code in touched files.

## Workstream split

| # | Workstream | Issues | Estimated effort |
|---|---|---|---|
| A | Correctness | 1, 2, 4 | 2-3 days |
| B | Recovery routing | 3 | 1-2 days |
| C | Tx & swap UX | 5, 6 | 2-3 days |

Workstreams have independent file footprints and no shared state. They may be merged as one PR or split per workstream — left as an implementation-time call.

---

## Architectural seams

These interfaces exist so future work (real-chain support, alternative price/token sources, additional error categories) does not require refactoring callers.

### `TokenDiscoveryProvider`
**Purpose:** Enumerate the ERC-20 tokens a wallet holds on a given chain.

```ts
interface TokenDiscoveryProvider {
  discover(chainId: SupportedChainId, address: Address): Promise<DiscoveredToken[]>;
}

interface DiscoveredToken {
  address: Address;          // 'native' for the chain's native token
  symbol: string;
  name: string;
  decimals: number;
  amountRaw: bigint;
}
```

**Initial implementation:** `RegistryDiscoveryProvider` — reads the supported-token list from `dexRegistry`, executes a single multicall of `balanceOf(wallet)` against the wallet's public client, filters to non-zero balances. Native balance fetched separately.

**Future implementations (out of scope, no refactor needed):** `MoralisDiscoveryProvider`, `IndexerDiscoveryProvider` (Ponder), `CompositeDiscoveryProvider` (merges multiple sources, dedupes by address).

### `PriceProvider`
**Purpose:** Quote USD prices for a set of tokens on a given chain.

```ts
interface PriceProvider {
  getPricesUsd(
    tokens: Array<{ symbol: string; address: Address; chainId: SupportedChainId }>
  ): Promise<Map<string, number | null>>;  // key by `${chainId}:${address.toLowerCase()}`
}
```

`null` means "price unavailable" and propagates as `—` in the UI rather than `$0.00`.

**Initial implementation:** `CoinCapPriceProvider` — reuses the existing `MarketService` (already configured with `EXPO_PUBLIC_COINCAP_API_KEY`).

**Future implementations:** `ChainlinkPriceProvider`, `CoinGeckoPriceProvider`, layered behind a `CompositePriceProvider` if needed.

### `SwapErrorClassifier`
**Purpose:** Map raw thrown errors from the swap pipeline into structured, presentable categories.

```ts
type SwapErrorKind =
  | 'network'
  | 'no_provider'
  | 'insufficient_balance'
  | 'insufficient_allowance'
  | 'slippage_invalid'
  | 'quote_stale'
  | 'simulation_revert'      // placeholder; populated only when full pre-flight ships (out of scope here)
  | 'user_rejected'
  | 'bundler_error'
  | 'unknown';

interface ClassifiedError {
  kind: SwapErrorKind;
  userMessage: string;        // human-friendly, no stack
  retryable: boolean;
  severity: 'info' | 'warning' | 'error';
  source?: string;             // optional: which service threw it (telemetry hook)
}

function classify(err: unknown): ClassifiedError;
```

Pure function. Adding a new kind = one map entry plus a UI severity assignment; no caller change.

---

## Cross-cutting UI quality requirements

Apply across every change in this spec:

- **No hardcoded colors.** Use `theme.colors` tokens. The codebase has already migrated; do not regress.
- **Reuse shared primitives.** Use existing `CardSkeleton`, `Skeleton`, `EmptyState`, status badges, banners, etc. from `shared/components/ui`. If a primitive does not exist (e.g., toast), introduce it minimally and consistently.
- **Loading states over spinners** where the resulting UI is structured (lists, cards). Use skeletons. Spinners are acceptable for bounded action confirmations (e.g., signing).
- **Severity-correct color usage.** `info`/`warning`/`error` map to `theme.colors.accentAlt` / `theme.colors.warning` / `theme.colors.danger`. User-rejection is `info`, not `error`.
- **Match existing layout rhythm.** Card padding, gap spacing, and typography in new UI must match what `DevicesPasskeysScreen`, `RecoveryEntryScreen`, and `DexScreen` already use.
- **Tap targets ≥ 44x44 pt** for any new icon button (close X, retry, etc.).
- **No emoji** in any user-facing string introduced by this work.

---

## Workstream A — Correctness

### A1. Real home balance (issue 1)

**Today:** `apps/mobile/src/shared/hooks/useWalletData.ts:31-94` calls `provider.getBalance(address)` via ethers, multiplies by hardcoded `2500`, returns one number. `BalanceCard` displays it. `PortfolioService` exists but is unused on the home screen.

**Target:** Home balance shows the real portfolio total in USD: native balance + ERC-20 holdings (from `dexRegistry`) on the active chain. The "active chain" is `useWalletStore.activeChainId ?? aaAccount.chainId ?? DEFAULT_CHAIN_ID`, matching the resolution pattern already used in `DevicesPasskeysScreen.tsx:73-76`.

**Data flow:**

```
HomeScreen
  → useWalletData(address, chainId)
      → PortfolioService.getPortfolio(address, chainId)
          → TokenDiscoveryProvider.discover(chainId, address)        // RegistryDiscoveryProvider
              → multicall balanceOf for every dexRegistry token
              → returns non-zero DiscoveredToken[] + native balance
          → PriceProvider.getPricesUsd(tokens)                        // CoinCapPriceProvider
              → returns Map<key, number | null>
          → merge → TokenBalance[] with .value (or null when price missing)
          → totalUsd = sum of priced values
      → return { ethAmount, tokens, totalUsd, missingPrices: string[] }
  → BalanceCard renders totalUsd; if missingPrices.length > 0, small "USD unavailable for N tokens" hint
```

**Implementation requirements:**

- `PortfolioService.getPortfolio(address, chainId)` must accept a `chainId` parameter; remove the hardcoded `anvil` chain and the `3245.32` fallback price.
- Native balance is always included regardless of registry contents.
- In-memory cache of discovery + prices for ~30 seconds. The 10s outer poll cadence stays the same; cache prevents redundant API hits.
- If `PriceProvider` returns `null` for the native token, display the native amount and a muted `—` for USD instead of `$0.00`.
- `useWalletData`'s public shape stays the same; only internals change. No caller updates required.

**Files touched:**

- `apps/mobile/src/features/portfolio/services/PortfolioService.ts` — extend
- `apps/mobile/src/features/portfolio/services/TokenDiscoveryProvider.ts` — new (interface + RegistryDiscoveryProvider)
- `apps/mobile/src/features/portfolio/services/PriceProvider.ts` — new (interface + CoinCapPriceProvider, wraps existing MarketService)
- `apps/mobile/src/shared/hooks/useWalletData.ts` — replace internals
- `apps/mobile/src/features/home/components/dashboard/BalanceCard.tsx` — show "USD unavailable" hint when applicable

### A2. No `-1` on failed tx in Recent Activity (issue 2)

**Today:** `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx:54-58`'s `getAmount(tx)` applies the `-` sign based purely on `direction === "outgoing"`, regardless of `tx.status`. A failed outgoing tx displays as `-1 ETH`. This is display-only; on-chain balance is fetched fresh each poll, so it is not actually deducted — but the visual implication is misleading. What was deducted is gas (failed txs still burn gas).

**Target:** Failed transactions display the attempted amount with no sign and a prominent Failed badge; the detail screen shows the actual gas-burned cost.

**Implementation requirements:**

- Update `getAmount(tx)`:
  - If `tx.status` is one of `failed | cancelled | dropped` → return `tx.amountDisplay` with no sign.
  - Otherwise unchanged (`-` for outgoing, `+` for incoming, none for self).
- Failed-row visual: muted text color (`theme.colors.textMuted`) + prominent red Failed badge using existing badge component.
- `TransactionDetailScreen` adds a "Gas burned" row for failed txs only, rendered as `gasUsed × effectiveGasPrice` in native units (and USD if a price is available).
  - If `wallet_transactions` does not currently persist `gas_used` and `effective_gas_price`, add nullable columns via a new migration in `apps/backend/supabase/migrations/`. Populate during receipt processing in `TransactionHistoryService` (the existing receipt-handling code path; identify the exact site at implementation time).
  - Do not block this workstream on backfill of historical failed txs — only forward-populate. Pre-existing failed txs without these fields show `—` for the gas line.

**Assumption:** No optimistic-balance-deduction path exists in the codebase (verified during exploration). If a user reports balance dropped by the *attempted amount* (not just gas), that's a separate bug not covered by this spec.

**Files touched:**

- `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx`
- `apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx`
- `apps/mobile/src/features/transactions/services/TransactionHistoryService.ts` — capture gas fields on receipt
- `apps/backend/supabase/migrations/<new>.sql` — add `gas_used`, `effective_gas_price` columns

### A3. Passkeys table writes (issue 4)

**Root cause:** `PasskeyService.syncPasskeyToCloud` exists at `apps/mobile/src/features/wallet/services/PasskeyService.ts:1173` but is only called from `DevicesPasskeysScreen.handleRegisterOnChain` (line 274) — i.e., only when the user manually taps the upload-cloud icon on the existing devices screen. The initial onboarding passkey, which is the only passkey most users ever have, is never synced.

**Target:** The `passkeys` table is populated automatically once a wallet is deployed, plus a lazy backfill for existing accounts.

**Implementation requirements:**

- **Auto-sync on deployment.** In the post-deployment success branch of `AccountDeploymentService` — specifically the path that sets `smartAccountDeployed = true` in `useUserStore` and persists the `aa_wallets` row — call `PasskeyService.syncPasskeyToCloud(userId, aaWalletId, metadata)` for the local onboarding passkey. Identify the exact call site at implementation time; the call must run after `aaWalletId` is known and before the user is navigated out of the deployment flow.
- **Lazy backfill on app start.** Run once per authenticated session (e.g., on `useUserStore` becoming `isLoggedIn && smartAccountDeployed`). Logic:
  1. `getPasskey(userId)` → skip if no local passkey.
  2. `fetchCloudPasskeys(userId)` → check if any returned credential matches the local one.
  3. If no match → call `syncPasskeyToCloud` with the local metadata.
- **Idempotency.** If `syncPasskeyToCloud`'s underlying insert is not already conflict-tolerant, change to `upsert(..., { onConflict: 'credential_id' })` once. This is a one-line SDK change inside `PasskeyService`.
- **Failure semantics.** Both auto-sync and lazy-backfill failures are non-fatal. Log and continue. Local passkey remains the source of truth for signing; the DB row is for visibility/multi-device.
- **Schema check at implementation time.** Confirm columns required by migration `20260503000000` (`credential_id_raw`, `public_key_x`, `public_key_y`, `rp_id`) are produced during local passkey creation. If `rp_id` or another column is `NOT NULL` and not currently captured at creation, either capture it on create or relax the constraint via a small follow-up migration.

**Files touched:**

- `apps/mobile/src/features/wallet/services/AccountDeploymentService.ts` — auto-sync after successful deployment
- `apps/mobile/src/features/wallet/services/PasskeyService.ts` — confirm `syncPasskeyToCloud` is upsert-style
- New hook: `apps/mobile/src/features/wallet/hooks/useLazyPasskeyBackfill.ts` — invoked once on authenticated mount; consumed at the auth-loaded boundary (e.g., from `RootNavigation` or a top-level layout)

### Workstream A acceptance criteria

- [ ] Home balance reflects on-chain native + ERC-20 totals on the active chain. Matches a manual `cast balance` (and `balanceOf` for ERC-20s) check on Anvil within the cache window.
- [ ] When CoinCap is unreachable, the home screen shows the native amount and a muted `—` USD value (no hardcoded fallback).
- [ ] A failed outgoing tx in Recent Activity displays the amount with no minus sign and a Failed badge.
- [ ] Tapping into Detail for a failed tx shows a "Gas burned" line with a real value (for txs created after this change ships).
- [ ] After creating a fresh wallet, the `passkeys` table contains a row matching the local credential within seconds of deployment.
- [ ] Re-launching the app on an existing account whose local passkey has no DB row populates the row within seconds.

---

## Workstream B — Recovery routing

### B1. Initial route decision adds passkey check

**Today:** `apps/mobile/src/app/navigation/RootNavigation.tsx:61` reads `splashTarget = isLoggedIn ? "DeviceVerification" : "AuthNavigation"`. The variable name "splashTarget" refers to the post-splash initial route resolution in the root navigator (not a separate splash screen). A logged-in user with no local passkey is routed to `DeviceVerification`, which only offers biometric/PIN auth, leaving them stuck.

**Target:** Replace the binary `isLoggedIn` check with a tri-state resolution:

```
RootNavigation initial route:
  → isLoggedIn?
      no  → AuthNavigation
      yes → hasLocalPasskey(userId)?
              yes → DeviceVerification
              no  → RecoveryEntry  (route param: reason="no_local_passkey")
```

**Implementation requirements:**

- `hasLocalPasskey` is a `PasskeyService.getPasskey(userId)` call wrapped in `withTimeout(1500)`.
- Timeout or error → fall through to `DeviceVerification` (current behavior). The inline escape hatch (B2) covers this case.

### B2. Inline escape hatch on DeviceVerification

**Implementation requirements:**

- Add a secondary button on `DeviceVerificationScreen`, below the biometric prompt:
  - Label: `"Don't have a passkey on this device? Recover account →"`
  - Action: `navigation.navigate("RecoveryEntry", { reason: "user_initiated" })`
- Visible always (not gated on retry count). This handles the user's "wrong passkey is present" case: if biometric repeatedly fails because the local passkey is from a different account, the user has a one-tap exit.
- Visual: secondary text-link styling consistent with other "alternative action" links in the app (look at `LoginScreen` for reference).

### B3. RecoveryEntry hardening

**Today:** `apps/mobile/src/features/recovery/screens/RecoveryEntryScreen.tsx:59-80` runs `Promise.all([getPasskey, getLatestActiveRecoveryRequestForUser])` with per-promise `withTimeout`, then renders branches based on resolved values. Reported glitches: stale state on re-entry, no distinct "loading" state vs "loaded with no passkey", and timeout/error silently fall through to `null` (looks identical to "no passkey").

**Target:** A single discriminated state, cancel-on-unmount, distinct error UI, and an explanatory header when entered with a `reason` route param.

**Implementation requirements:**

- Replace ad-hoc `useState`s with one discriminated state:
  ```ts
  type RecoveryEntryState =
    | { kind: 'loading' }
    | { kind: 'no_passkey'; activeRequest: ActiveRecoveryRequest | null }
    | { kind: 'has_passkey'; activeRequest: ActiveRecoveryRequest | null }
    | { kind: 'has_active_request'; request: ActiveRecoveryRequest }
    | { kind: 'error'; message: string };
  ```
- Cancel in-flight effects on unmount via an `AbortController` or a mounted-flag closure. Fast back/re-enter sequences must not show stale state.
- Distinguish timeout/error from `null` results. Error state renders a "Couldn't check device — Retry" UI.
- When `route.params.reason` is set, render an explanatory header above the options:
  - `no_local_passkey` → "We didn't find a passkey on this device."
  - `user_initiated` → "Recover your account"

### Workstream B acceptance criteria

- [ ] Logging in on a device with no local passkey lands directly on `RecoveryEntry`. No biometric prompt flash, no dead-end.
- [ ] `DeviceVerification` always shows the "Recover account" link; tap navigates to `RecoveryEntry`.
- [ ] `RecoveryEntry` never flickers between options during load; shows a single clear loading state, then exactly one of {no passkey, has passkey, active request, error}.
- [ ] Re-entering `RecoveryEntry` quickly (back, then re-enter) does not show stale state from the previous load.
- [ ] When `RecoveryEntry`'s checks time out or error, the user sees a Retry UI, not a misleading "no passkey" state.

---

## Workstream C — Tx & swap UX

### C1. Back/exit on TransactionStatus + TransactionDetail (issue 5)

**Today:** Both screens are in the modal stack at `apps/mobile/src/app/navigation/RootNavigation.tsx:404-411` with `headerShown: false` and no in-screen exit. Swipe-back is the only way out.

**Implementation requirements:**

- **Top-left close (X) icon** on both `TransactionStatusScreen` and `TransactionDetailScreen`. Implemented as an absolutely-positioned `TouchableOpacity` in screen JSX (keeps `headerShown: false`, matches other modal screens). Tap → `navigation.popToTop()`.
- **"Done" primary button on `TransactionStatusScreen`**, full-width at the bottom:
  - When tx state is terminal (`confirmed | failed | cancelled | dropped`) → label: "Done".
  - When tx state is non-terminal → label: "Close".
  - Both → `navigation.popToTop()`.
- `TransactionDetailScreen` keeps its existing "Refresh" button; only adds the close X.
- `popToTop()` lands the user on the wallet/home tab regardless of origin (DEX, Send, etc.). This is the desired behavior.

### C2. Swap reliability + UX (issue 6, level B)

#### C2.a Error classification

New file: `apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts`. Pure function `classify(err) → ClassifiedError` per the interface in *Architectural seams*.

Implementation maps existing thrown error messages from the swap pipeline to `kind`s:

| Source (file:approx-line) | Thrown message pattern | Mapped `kind` | Severity |
|---|---|---|---|
| SwapQuoteService:79, 89 | `No swap provider...` | `no_provider` | error |
| SwapQuoteService:24, 99 | `Slippage must be between...` | `slippage_invalid` | error |
| SwapPreparationService:199, 289 | `Insufficient sell token balance` | `insufficient_balance` | error |
| SwapPreparationService:154, 157 | network/wallet validation throws | `unknown` (default) | error |
| SwapExecutionService:175 | user-rejected during signing | `user_rejected` | info |
| Bundler RPC 4xx/5xx, fetch failure | various | `bundler_error` / `network` | error / warning |
| New: stale-quote check (C2.c) | thrown by execution service | `quote_stale` | warning |

Default case returns `{ kind: 'unknown', userMessage: <stringified err>, retryable: false, severity: 'error' }`.

#### C2.b UI rendering in DexScreen

- Replace `errorMessage: string | null` state with `errorState: ClassifiedError | null`.
- Banner renderer reads `severity` for color (`info` / `warning` / `error`) and `retryable` for the presence of a "Try again" button next to the message.
- For `user_rejected` → render as a small inline info pill near the action button. **Not** a red banner.
- Toast hook for transient `network` errors during background quote-poll loops where the banner has already cleared. Use the simplest in-app toast primitive (introduce one if none exists; one consumer is enough to justify a tiny component).
- Retry button action: re-runs the failed step (re-fetch quote, re-attempt approval, or re-attempt swap). It does **not** blindly resubmit — it returns to the action that originally errored.

#### C2.c Proactive guards

1. **RPC timeout + retry around quote fetches.**
   - Wrap `SwapQuoteService.getQuote()`'s outbound calls with `withTimeout(8000)` and one automatic retry on timeout/network error. Subsequent failures bubble up as classified `network` errors.
   - Same wrapper around `AllowanceService.isApprovalRequired()`.

2. **Quote staleness check.**
   - Tag every `SwapPlan` returned by `SwapPreparationService` with `quotedAt: number` (epoch ms).
   - Add `MAX_QUOTE_AGE_MS = 30_000` constant.
   - In `SwapExecutionService.executeSwap()`, before signing, if `now - plan.quotedAt > MAX_QUOTE_AGE_MS`:
     - Re-fetch the quote inline. Replace `plan` with the fresh one.
     - If the new `amountOut` is materially worse than the original (drift exceeds the user's slippage tolerance), throw a `quote_stale` error. UI shows "Quote changed — review again".
   - During the inline re-fetch, `DexScreen` shows a small "Quote refreshing…" indicator on the confirm button.

3. **User-rejection treated as info.**
   - In `DexScreen`'s `handleExecuteSwap` catch, when the cancellation result returns from `SwapExecutionService`, classify as `user_rejected` and render the info pill. Form state preserved so the user can immediately retry.

### Workstream C acceptance criteria

- [ ] Tapping X on either tx screen, or Done on a terminal status, returns the user to the wallet/home tab.
- [ ] The following swap failures each produce a distinct, classified, human-readable message in the correct severity color: insufficient balance, network drop, slippage error, user rejection, bundler error.
- [ ] A retry button appears only for retryable kinds and re-runs the originating step (no blind resubmit).
- [ ] Cancelling the passkey prompt during a swap does not show a red error banner.
- [ ] A swap held at the confirm step for >30 seconds re-fetches the quote on submit. If the price moved beyond slippage, the user sees "Quote changed — review again" instead of silently signing.

---

## Testing strategy

### Workstream A
- Unit-test `RegistryDiscoveryProvider` with a mocked public client returning fixed `balanceOf` results across a small token set; assert non-zero filtering and native inclusion.
- Unit-test `CoinCapPriceProvider` in two modes: success (returns prices) and outage (returns all-`null`).
- Unit-test `PortfolioService.getPortfolio` with stubbed providers; assert `totalUsd`, `tokens`, and `missingPrices` shapes.
- Unit-test `ActivityFeed.getAmount` against rows for each `status` value; assert no minus sign for failed/cancelled/dropped.
- Manual: run against local Anvil + bundler stack. Mint test tokens, observe portfolio total updates within 30s. Send a tx that reverts (e.g., insufficient downstream balance), observe Activity row shows attempted amount with no sign + Failed badge; tap into Detail and verify "Gas burned" matches `cast tx <hash>` output.
- Manual passkeys: create a fresh wallet end-to-end, observe `passkeys` row exists in Supabase (`select * from passkeys`). Then nuke the row manually and re-launch the app; observe lazy backfill repopulates within seconds.

### Workstream B
- Unit-test the `RecoveryEntryState` reducer / state derivation for each combination of {has-passkey, has-active-request, timeout, error}.
- Manual: log in fresh on a clean device install with the user already having an active account in DB+chain on another device. Verify auto-route to `RecoveryEntry`, no biometric flash.
- Manual: with a valid local passkey, `DeviceVerification` is shown, and the "Recover account" link is visible and works.
- Manual: navigate into `RecoveryEntry`, swipe back, immediately re-enter — verify no stale state.
- Manual: simulate a slow `getPasskey` (instrument with a `setTimeout` during dev) so it exceeds the 1500ms splash timeout — verify fallthrough to `DeviceVerification`, plus the inline link still works.

### Workstream C
- Unit-test `classify()` against every documented thrown-message pattern; assert correct `kind`, `severity`, `retryable`.
- Unit-test stale-quote detection in `SwapExecutionService.executeSwap` with a stubbed clock and provider.
- Manual: perform a swap end-to-end on the local fork. Verify Done button returns to wallet home.
- Manual: cancel the passkey prompt mid-swap; verify info pill, no red banner, form preserved.
- Manual: stop the local bundler container while a swap is in flight; verify classified network error + retry button works once the bundler is back.
- Manual: open swap, fill amount, wait >30s, then submit; verify "Quote refreshing…" indicator and either a successful quote refresh or a `quote_stale` warning if the price moved.

---

## Risks & rollback

- **A1 (price provider):** CoinCap rate limits / outages. Mitigation: 30s in-memory cache, graceful `null` handling, no fallback hardcoded prices.
- **A3 (passkey sync):** if `syncPasskeyToCloud` writes the wrong shape relative to the `passkeys` table schema, the insert silently fails (current observable state). Mitigation: at impl time, call `syncPasskeyToCloud` once during dev, observe the result row, and fix any column mismatch before merging.
- **B1 (splash routing):** a slow `getPasskey` could push every cold-start user to `RecoveryEntry`. Mitigation: 1500ms timeout falls through to `DeviceVerification` (current behavior); inline escape hatch always available.
- **C2 (stale-quote):** re-fetching inline before signing adds latency. Mitigation: only triggers after 30s idle; user already paused. Show the "Quote refreshing…" indicator.

Each workstream is independently revertable. If shipping as a single PR, revert reverts the whole pass; if shipping as three PRs, each can revert in isolation.

---

## Out of scope / future work

- On-chain `simulateContract` / `eth_call` pre-flight for swap user-ops (the C-level work). Wants its own focused pass with end-to-end testing on the bundler.
- Improvements to the recovery flows themselves (Guardian, Email).
- Multi-source token discovery (Moralis + indexer composite). Already supported by the seam; wiring deferred until we target a real chain.
- Backfill of `gas_used` / `effective_gas_price` for historical failed transactions.
- Production price oracles (Chainlink etc.).
- A "trusted devices" UI — already implemented in `DevicesPasskeysScreen`; this spec only ensures it has data.
