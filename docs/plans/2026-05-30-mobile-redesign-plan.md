# Mobile Dark-Mode Redesign — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) tracking.
>
> **READ FIRST:** `docs/plans/2026-05-30-mobile-redesign-spec.md` — the locked design spec (all tokens, per-screen layouts, the chart/shelf rules). This plan implements that spec; the spec is the source of truth for any visual detail.

**Goal:** Enforce and refine the existing design system across the core product screens (Home, Portfolio, Discover/Market, Token Detail), starting by making the design system actually load (fonts) and consolidating tokens.

**Architecture:** Stream 0 (shared foundation) ships FIRST and gates everything. Then Stream B (core screens) builds on it. Profile (Stream A) is out of scope for this plan.

**Tech stack:** Expo SDK 54, React Native 0.81.5, React 19, TypeScript, Zustand, @tanstack/react-query, @gorhom/bottom-sheet, react-native-reanimated, expo-font, @expo-google-fonts/*, Skia, expo-linear-gradient.

---

## CRITICAL CONSTRAINTS (read before any task)

1. **Worktree / npm install:** This repo's worktrees live under `D:\trezo` and resolve `node_modules` upward to the **root** `D:\trezo\node_modules`. **NEVER run `npm install` inside the worktree.** New dependencies (the `@expo-google-fonts/*` packages) must be added at the **repo root `D:\trezo`** (coordinate with the user — see Task 1). If the packages are already present after root install, the worktree resolves them automatically.
2. **No jest.** Tests are plain `tsx` scripts with **relative imports only** (esbuild can't resolve `@/` aliases and can't import react-native/expo modules). Put pure, testable logic in standalone modules (no RN imports) with a sibling `__tests__/<name>.test.ts`, and add them to the `test:dapp` script in `apps/mobile/package.json`. Pattern reference: `src/features/browser/utils/backAction.ts` + its test.
3. **Never `--no-verify`. Never add `Co-Authored-By: Claude`** to commits.
4. **Do NOT touch:** the Browser chrome / webview (`BrowserScreen` webview logic, tabs, top bar) — only `DiscoverHome` content. The benchmark screens (Splash, Onboarding first-3, Simulation/DEX) — only the global font/token fixes reach them.
5. **Testnet-demoable:** no dead buttons. Gated actions per the spec §7.
6. **Type-check after each task:** `cd apps/mobile && npx tsc --noEmit` — your edits must be clean (there are pre-existing errors in unrelated files; don't add new ones in files you touch).
7. **Commit after each task** with a clear message; do not batch unrelated changes.

---

## STREAM 0 — Foundation (ships first, gates everything)

### Task 1: Load the fonts (P0)
**Files:** `apps/mobile/package.json` (root install — see constraint 1), `src/shared/hooks/useCachedResources.ts`, `App.tsx` (optional splash).

**Context (VERIFIED by recon):** There are **zero font files** in the repo and **no `@expo-google-fonts` packages** installed. `FontFamilies` (`src/shared/components/TokenRegistry.ts:12-27`) uses **PostScript-style names**, NOT `@expo-google-fonts` export names:
```ts
export const FontFamilies = {
  sans: "Inter", sansBold: "Inter-Bold", sansBlack: "Inter-ExtraBold",
  serif: "PlayfairDisplay-Regular", serifBold: "PlayfairDisplay-Bold",
  mono: "JetBrainsMono-Regular", monoMedium: "JetBrainsMono-Medium",
};
```
`Typography` references those exact strings as `fontFamily`. So **`useFonts` MUST register the fonts under these exact key names** (alias the `@expo-google-fonts` exports). If you use the default export names (`Inter_700Bold`), every `fontFamily: "Inter-Bold"` stays broken and the whole task silently fails.

The single UI gate is `useCachedResources()` (file is `src/shared/hooks/UseCachedResources.ts`, capital U; currently returns a bool `isReady` gated only on `useSupabaseAuth` loading). `App.tsx`'s `AppBootstrap` already shows a boot `ActivityIndicator` until that hook is ready — no App.tsx structural change needed.

- [ ] **Step 1 — Add packages at ROOT.** Ask the user to run, at `D:\trezo` (NOT the worktree): `npm install @expo-google-fonts/inter @expo-google-fonts/playfair-display @expo-google-fonts/jetbrains-mono`. Confirm they appear in root `node_modules` before continuing.
- [ ] **Step 2 — Load in `UseCachedResources.ts` with ALIASED keys** so they match `FontFamilies` exactly:
```ts
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
// ...inside the hook:
const [fontsLoaded] = useFonts({
  "Inter": Inter_400Regular,
  "Inter-Bold": Inter_700Bold,
  "Inter-ExtraBold": Inter_800ExtraBold,
  "PlayfairDisplay-Regular": PlayfairDisplay_400Regular,
  "PlayfairDisplay-Bold": PlayfairDisplay_700Bold,
  "JetBrainsMono-Regular": JetBrainsMono_400Regular,
  "JetBrainsMono-Medium": JetBrainsMono_500Medium,
});
// ...gate readiness on BOTH:
return isReady && fontsLoaded;
```
(Verify the exact export names exist in each package's index — `@expo-google-fonts` exports `<Family>_<weight><Style>`. If `Inter_800ExtraBold` isn't exported, use the nearest available and keep the alias key `"Inter-ExtraBold"`.)
- [ ] **Step 3 — (Optional) expo-splash-screen** (`~31.0.13`, already installed) in `App.tsx`: `SplashScreen.preventAutoHideAsync()` at module top; `SplashScreen.hideAsync()` once ready. Note: there is NO existing `preventAutoHideAsync`/`hideAsync` call today (the in-app `SplashScreen.tsx` is a custom auth component, unrelated).
- [ ] **Step 4 — Verify on device:** restart Metro with `-c` (clear cache). Confirm headings/numbers render in Inter/JetBrains Mono (not system font). Benchmark screens (Splash/Onboarding) should visibly sharpen. **This is the single highest-impact change — verify it before moving on.**
- [ ] **Step 5 — Commit:** `feat(design-system): load Inter/Playfair/JetBrainsMono fonts (P0 — fonts never loaded before)`.

### Task 2: Token cleanup + gain/loss tokens
**Files:** `src/theme/types.ts`, `src/theme/themes.ts`, + 5 files using `secondaryText`.

- [ ] **Step 1** — Add `dataPositive: "#34D399"` and `dataNegative: "#E8654F"` to `ThemeColors` + both theme blocks (dark + light).
- [ ] **Step 2** — Remove the `secondaryText` alias. VERIFIED blast radius: only **1 real theme-token consumer** — `src/features/wallet/screens/DevCreateAccountScreen.tsx:21` (`theme.colors.secondaryText`) → change to `textSecondary`. CAUTION: `src/features/auth/screens/WelcomeScreen.tsx` has a **local StyleSheet key also named `secondaryText`** (line 53) — that is NOT the theme token; do NOT touch it. Then remove `secondaryText` from `ThemeColors` (`types.ts:20`) + both theme blocks (`themes.ts:19,56`). Run `tsc --noEmit` to confirm none missed.
- [ ] **Step 3 — Commit:** `refactor(theme): add data+/- tokens, remove secondaryText alias`.
- [ ] (Defer `text` alias removal — 22 refs, optional.)

### Task 3: Pure helpers for the tiered chart + allocation (testable)
**Files:** Create `src/features/portfolio/utils/portfolioChart.ts` + `__tests__/portfolioChart.test.ts`; create `src/features/portfolio/utils/allocation.ts` + `__tests__/allocation.test.ts`. Update `apps/mobile/package.json` `test:dapp`.

Keep these PURE (no RN imports) so `tsx` can test them. Relative imports only in tests.

- [ ] **Step 1 — `portfolioChart.ts`:** implement and export:
```ts
export type Period = "1D" | "1W" | "1M" | "1Y" | "ALL";
/** Which periods are enabled given wallet age in days. 1D always on; others need >= their span. */
export function enabledPeriods(walletAgeDays: number): Record<Period, boolean> {
  return {
    "1D": true,
    "1W": walletAgeDays >= 7,
    "1M": walletAgeDays >= 30,
    "1Y": walletAgeDays >= 365,
    "ALL": walletAgeDays >= 1,
  };
}
/** Warm message shown when a disabled period is tapped (NO lock icon in UI). */
export function disabledPeriodMessage(period: Period, walletAgeDays: number): string {
  const span: Record<Period, string> = { "1D": "1 day", "1W": "1 week", "1M": "1 month", "1Y": "1 year", "ALL": "your full history" };
  return `${period} isn't ready yet — your wallet is ${walletAgeDays} day${walletAgeDays === 1 ? "" : "s"} old. Showing since you started for now.`;
}
/** Deposit-adjusted value change over a window. netFlows = deposits - withdrawals (USD) during the window. */
export function valueChange(startValue: number, endValue: number, netFlows: number): { delta: number; pct: number } {
  const adjustedStart = startValue + netFlows; // funding raises the baseline, not the gain
  const delta = endValue - adjustedStart;
  const pct = adjustedStart > 0 ? (delta / adjustedStart) * 100 : 0;
  return { delta, pct };
}
```
- [ ] **Step 2 — test** `enabledPeriods` (age 0 → only 1D; age 3 → 1D+ALL, 1W/1M/1Y off; age 400 → all on), `valueChange` (deposit does not count as gain: start 100, end 600, netFlows 500 → delta 0, pct 0), `disabledPeriodMessage` (contains the age + "since you started"). Hand-rolled `assertEqual`, `process.exit(1)` on fail, print `OK ... (N assertions)`. Mirror `backAction.test.ts`.
- [ ] **Step 3 — `allocation.ts`:**
```ts
export type Holding = { symbol: string; valueUsd: number };
export type AllocSegment = { symbol: string; valueUsd: number; pct: number };
/** Sorted desc by value; pct of total. Tiny holdings (< minPct) fold into "Other". */
export function computeAllocation(holdings: Holding[], minPct = 3): AllocSegment[] {
  const total = holdings.reduce((s, h) => s + Math.max(0, h.valueUsd), 0);
  if (total <= 0) return [];
  const segs = holdings
    .filter((h) => h.valueUsd > 0)
    .map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd, pct: (h.valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const big = segs.filter((s) => s.pct >= minPct);
  const small = segs.filter((s) => s.pct < minPct);
  if (small.length) {
    const otherVal = small.reduce((s, x) => s + x.valueUsd, 0);
    big.push({ symbol: "Other", valueUsd: otherVal, pct: (otherVal / total) * 100 });
  }
  return big;
}
```
- [ ] **Step 4 — test** `computeAllocation` (empty → []; sums to ~100%; small holdings fold into "Other"; sorted desc).
- [ ] **Step 5** — append both test files to `test:dapp` in `apps/mobile/package.json`; run `npm run test:dapp` (from `apps/mobile`) — all green.
- [ ] **Step 6 — Commit:** `feat(portfolio): pure tiered-chart + allocation helpers w/ tsx tests`.

---

## STREAM B — Core screens (after Stream 0)

> Each screen: implement per spec §5, type-check, verify on device, commit. Restyle to the locked radius/spacing/color tokens. Use `TokenIcon` everywhere; tap → `TokenDetailModal`.

### Task 4: Token Detail → bottom-sheet + gated actions
**Files:** `src/features/portfolio/components/TokenDetailModal.tsx`; delete `src/features/home/components/Market/TokenDetailSheet.tsx` (orphan).
- [ ] Convert presentation from centered `Modal` to a `@gorhom/bottom-sheet` / `TrezoBottomSheet` (radius 28 top). Keep `InteractiveChart`, period picker (full 1D/1W/1M/1Y — market history, NO tiering here), stats grid.
- [ ] Action row logic. The Buy/Swap split is by **buyability on Transak (ETH-only)**, NOT swappability. Rule: if `symbol === "ETH"` → show **Buy** (→ `navigation.navigate('Buy')` — route confirmed in `RootNavigation.tsx`, `BuyScreen`); else show **Swap** (→ `navigation.navigate('Dex', { initialTab:'swap', preselect })`). Use `isTokenSwappableOnTestnet(symbol)` (`src/services/market/testnetBias.ts`) to decide whether Swap is even offered (its set = ETH/USDC/USDT/DAI/WETH/WBTC — **NOTE: LINK is NOT in this set though dexRegistry has a LINK/WETH pool on base-sepolia; reconcile by adding LINK to the set OR confirm LINK swaps work before showing the button — no dead buttons**). Send/Receive always present.
- [ ] Delete the orphan `TokenDetailSheet.tsx`; confirm nothing imports it (`tsc`).
- [ ] Type-check, device-verify (tap a coin from Portfolio), commit.

### Task 5: Portfolio screen
**Files:** `src/features/portfolio/screens/PortfolioScreen.tsx`; new `usePortfolioSnapshots`/replace `usePortfolioHistory`; reuse `AssetList`, `InteractiveChart`, the Task 3 helpers.
- [ ] Header → clean `Portfolio` title (kill `MY VAULT`/`PERFORMANCE`).
- [ ] **Replace `usePortfolioHistory`** (price-only) with snapshot-backed history per spec §6. Add a daily total-USD snapshot writer (write one row/day on app-foreground; store via existing persistence — MMKV/Supabase as fits the codebase). 1D from live price feed; 1W+ from snapshots.
- [ ] Period picker uses `enabledPeriods(walletAgeDays)`; disabled tabs **dimmed, no lock icon**; tap disabled → toast with `disabledPeriodMessage(...)`.
- [ ] Allocation stacked bar + key from `computeAllocation(holdings)`.
- [ ] Holdings: full list, % share, value, 24h (gain/loss tokens), sort by value; tap → TokenDetailModal.
- [ ] **Remove** the inline market strip. Add Popular-on-testnet shelf (spec §7).
- [ ] Empty ($0): fund prompt (Buy ETH + Receive) + native ETH @0 + Popular shelf; no chart.
- [ ] Type-check, device-verify (funded + simulate empty), commit.

### Task 6: Home screen
**Files:** `src/features/home/screens/HomeScreen.tsx`, `components/dashboard/BalanceCard.tsx`, `ActionGrid.tsx`, `ActivityFeed.tsx`; wire `AssetList`; `src/shared/hooks/useWalletData.ts`.
- [ ] **Wire real 24h change:** replace `useWalletData`'s hardcoded `totalChange24h: 0` with a real computation (current balances × price-24h-ago from the market feed). Remove BalanceCard's fake `+4.2%`.
- [ ] BalanceCard: fix gradient to `gradients.brand`; add real 24h change (gain/loss) + sparkline; number light-weight (300), mono.
- [ ] Slim header (kill big WALLET/TREZO block; keep ChainSwitcherChip + bell).
- [ ] Action hierarchy: Receive + Send primary; Swap + Buy quiet.
- [ ] **YOUR ASSETS** section — render `AssetList` (top holdings + "See all →" → Portfolio).
- [ ] Recent Activity: keep last-3 + real `EmptyState`.
- [ ] Trending: demote to one compact bottom shelf.
- [ ] Empty ($0): honest $0.00 flat card, actions flip to Receive+Buy (Send/Swap disabled), "Fund your wallet" card + native ETH @0, trending shelf.
- [ ] Type-check, device-verify (funded + empty), commit.

### Task 7: Discover landing (single scroll)
**Files:** `src/features/browser/components/discover/DiscoverHome.tsx`, `TrendingTokensRow.tsx`, `TrendingSitesRow.tsx`, `NewsFeed.tsx`, `UnifiedSearchBar.tsx`; reclaim `src/features/home/components/dashboard/MarketExplorer.tsx`; delete dead `MarketSection.tsx`.
- [ ] Keep single continuous scroll: Search → Trending → Market → Apps → News. (No segmented control.)
- [ ] Fix section headers → legible `textPrimary` `SectionHeader` (was textSecondary @0.6 opacity).
- [ ] **Market section** = reclaimed `MarketExplorer` vertical list (Sparkline + price + 24h); tap → TokenDetailModal. Browse-all + gated actions (spec §7).
- [ ] **Kill rogue site palette** in `TrendingSitesRow` → on-brand violet tints / `TokenIcon`.
- [ ] Apps list: on-brand icons + category chips; "Open" → in-app browser (do NOT touch browser chrome).
- [ ] Delete dead `MarketSection.tsx`; confirm no imports.
- [ ] Type-check, device-verify, commit.

### Task 8: Cleanup pass
- [ ] Delete orphans confirmed unused: `MarketSection.tsx`, `TokenDetailSheet.tsx` (if not already). Run `tsc --noEmit` clean for all touched files.
- [ ] Grep for off-scale radii (14/18/22/32) and rogue hex in touched files; align to tokens.
- [ ] Final `npm run test:dapp` green. Commit.

---

## Self-review checklist (run before handoff back to user)
- [ ] Fonts visibly loaded on device (Task 1 verified) — the P0.
- [ ] No dead buttons; gated actions correct (ETH→Buy, USDC/LINK→Swap).
- [ ] No fake numbers (24h change is real or absent).
- [ ] Browser chrome + benchmark screens untouched.
- [ ] `tsc --noEmit` adds no new errors in touched files; `test:dapp` green.
- [ ] Empty-wallet states correct on Home + Portfolio.
