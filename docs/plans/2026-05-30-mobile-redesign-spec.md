# Mobile Dark-Mode Redesign — Design Spec (Source of Truth)

> Status: **LOCKED** (2026-05-30). Direction validated screen-by-screen with the user via browser mockups.
> Mockups: `.superpowers/brainstorm/10670-1780162834/content/*.html` (gitignored; reference only).

## 0. Direction & Governance

**Direction = B + A-governor + C-moments ("the Phantom model"):**
- **B — Confident Fintech** structure for core money screens (Home, Portfolio, DEX, Discover/Market, Token Detail).
- **A — Quiet-Private-Bank restraint** governs *every* screen: one accent per screen, type before color, ivory text never `#FFFFFF`, terracotta never crimson, negative space mandatory.
- **C — Expressive moments** rationed to: Splash, Onboarding, empty states, success/confirm, recovery ceremony. Never C in the *path* of a core money action.

**Scope = ENFORCE & REFINE, not reinvent.** The existing design language is strong; it is simply **not enforced** (fonts never load, tokens drift, a few rogue hardcoded colors). Most of this work is propagation + subtraction.

**Hard boundaries (do NOT violate):**
- **Do NOT touch the Browser chrome** (the in-app webview shell, tabs, top bar, `BrowserScreen` webview logic). Only the **Discover landing** (`DiscoverHome`) content changes.
- **Do NOT restyle the benchmark screens** (Splash, Onboarding first 3, Simulation/DEX). They are the reference. They only benefit from the global font-load + token fixes.
- **Keep violet.** The hue is a brand asset; the "AI feel" was unloaded fonts + rogue neon palettes, not the accent.
- **Testnet-demoable rule:** every shipped action must work end-to-end on testnet. No dead buttons. No mainnet-only actions.

---

## 1. Color — Roles (dark mode)

Keep the palette. Fix the plumbing. Source: `src/theme/themes.ts`, `src/theme/types.ts`.

| Role | Token | Dark value | Rule |
|---|---|---|---|
| Canvas | `background` | `#060608` | base |
| Surface (loud card) | `surfaceCard` | `rgba(18,15,24,0.70)` | primary cards |
| Glass (quiet card) | `glass` | `rgba(244,241,234,0.02)` | details cards |
| Hairline | `border` | `rgba(124,58,237,0.10)` | ghost-violet — keep |
| Text primary | `textPrimary` | `#F4F1EA` | never `#FFFFFF` |
| Text secondary | `textSecondary` | `#8E8B85` | labels |
| Text muted | `textMuted` | `#5C5A55` | metadata only |
| Accent | `accent` | `#7C3AED` | **interactive only**, not decoration |
| Accent sub | `accentAlt` | `#06B6D4` | secondary; never gradients |
| Success | `success` | `#10B981` | tx confirmed / positive system |
| Danger | `danger` | `#E8654F` | destructive/failed — terracotta |
| Warning | `warning` | `#F59E0B` | caution |
| Ceremony | `gold` | `#C9A961` | C-zone (recovery) only |

### 1.a Token cleanup (`Δ`)
- **Delete `secondaryText`** alias (9 refs in 5 files) → replace all with `textSecondary`. Remove from `ThemeColors` type + both theme blocks.
- `text` alias (22 refs) → lower priority; may defer. If touched, replace with `textPrimary`.
- **Add gain/loss tokens** (semantically distinct from success/danger): `dataPositive: "#34D399"`, `dataNegative: "#E8654F"`. Use these for price/portfolio up/down. ("Loss" ≠ "failed".)

### 1.b Surgical offender fixes (`Δ`)
- **`TrendingSitesRow`** hardcoded palette `["#6C63FF","#3DDC84","#FF6B6B","#F7C948","#4FC3F7","#FF7043"]` → **delete**; use on-brand violet tints (`rgba(124,58,237,0.14)` bg + `#c4b5fd` glyph) or `TokenIcon`.
- **BalanceCard** gradient `["#8B5CF6","#7C3AED","#6027D9"]` → use theme `gradients.brand` (`#6D28D9` third stop). (`BalanceCard.tsx:87`)
- **Fake `+4.2%`** badge in BalanceCard → delete. Wire real 24h change or render nothing until data exists. Never a fake number on a money screen.

---

## 2. Typography — P0 unlock

**LOAD THE FONTS.** Today every screen renders the OS system font because nothing calls `expo-font`. `FontFamilies` (in `src/shared/components/TokenRegistry.ts`) uses `@expo-google-fonts` naming exactly (`Inter_400Regular`, `PlayfairDisplay_700Bold`, `JetBrainsMono_500Medium`) but the packages were never installed and there are **zero font files in the repo**.

**Fix:** add `@expo-google-fonts/inter`, `@expo-google-fonts/playfair-display`, `@expo-google-fonts/jetbrains-mono`; load via `useFonts(...)` in `src/shared/hooks/useCachedResources.ts`; AND the result into the readiness flag. (See plan Task 1 — note the worktree/npm-install constraint.)

Type ramp rule: **large text = light weight (300); small labels/brand = heavy.** Numbers always JetBrains Mono. Serif (Playfair) = C-zone ceremony only.

---

## 3. Spacing · Radius · Elevation

- **Spacing:** single **8-pt scale** (`Spacing` object: 4/8/12/16/20/24/32/40/48) for ALL new redesign work. **Keep `Phi` confined to the protected auth/onboarding benchmark screens** — do not rip it out of them.
- **Radius scale, LOCKED — only these:** `8` chips/inputs · `12` pills/token-chips/segmented · `16` cards & list rows · `20` glass-details/modals · `28` hero cards + bottom-sheet top · `999` primary pill/avatar/circular. Ban off-scale (14/18/22/32) in new/edited components.
- **Elevation:** keep existing 3-level shadow set + glow set.

---

## 4. Components — consolidations (`Δ`)

| Decision | Action |
|---|---|
| **One token icon** | `TokenIcon` is the only way to render a token. Kill letter-initial circles in `TrendingTokensRow`, `TrendingSitesRow`. |
| **One token detail** | `TokenDetailModal` is canonical. Delete orphan `src/features/home/components/Market/TokenDetailSheet.tsx`. Convert `TokenDetailModal` to a **bottom-sheet** presentation. |
| **One Market list** | Reclaim `MarketExplorer` as the Discover Market section. Delete Portfolio's inline market strip + the dead `MarketSection`. |
| **Primary action** | Filled-violet full-pill = THE primary CTA. |
| **Section header** | One `SectionHeader` (legible `textPrimary` label + optional "See all →"). Fix Discover's near-invisible headers. |
| Keep as-is | `Button`, `Card`, `Input`, `Badge`, `TrezoBottomSheet`, `InteractiveChart`, `Sparkline`, the tab bar. |

---

## 5. Per-screen specs

### 5.1 Home (`src/features/home/screens/HomeScreen.tsx`)
Two states keyed on holdings.

**FUNDED:**
1. **Slim header** — small wordmark left; `ChainSwitcherChip` + notifications bell right. (Kill the big `WALLET`/`TREZO` block.)
2. **Balance hero** — violet gradient card (the one sanctioned gradient on Home). REAL 24h change (gain/loss color) + sparkline. Number light-weight (300), mono. Address pill + copy.
3. **Actions** — Receive + Send **primary** pills; Swap + Buy quiet/secondary.
4. **YOUR ASSETS** — wire the already-built `AssetList` (top holdings + "See all →" → Portfolio). Rows: `TokenIcon` + symbol/name + balance(mono) + value + 24h (gain/loss). Tap → `TokenDetailModal`.
5. **Recent Activity** — last 3 + "See all →". Real `EmptyState` (not 12px muted text).
6. **Trending** — ONE compact bottom shelf (demoted).

**EMPTY ($0):** honest `$0.00`, flat (non-glow) card, NO fake change/sparkline. Actions FLIP: **Receive + Buy** primary; Send + Swap disabled. Body = **"Fund your wallet"** card + single native ETH row at `0.00` (gas asset) — NOT a fake multi-token list. Trending shelf still shown.

**News:** never on Home (lives in Discover only).
**Data prereqs:** `useWalletData.totalChange24h` is hardcoded `0` — wire real value (Task in plan).

### 5.2 Portfolio (`src/features/portfolio/screens/PortfolioScreen.tsx`)
Home = act; Portfolio = analyze.
1. **Header** → clean `Portfolio` title (kill `MY VAULT`/`PERFORMANCE`; matches Home treatment).
2. **Performance hero** — `InteractiveChart` (bigger than Home's sparkline, scrub-to-read) + **tiered period picker** (see §6).
3. **Allocation** — NEW. Stacked horizontal bar + key (ETH 60% / USDC 25% / …). Pure-function `computeAllocation`.
4. **Holdings** — full list with % share + value + 24h (gain/loss), sort by value. Tap → `TokenDetailModal`.
5. **Popular on testnet** shelf — see §7. Kept on BOTH empty + funded.
6. **REMOVE** the hand-rolled inline market strip.
**EMPTY ($0):** fund prompt (Buy ETH + Receive) + native ETH at 0 + Popular shelf; **no chart** (see §6).

### 5.3 Discover landing (`src/features/browser/components/discover/DiscoverHome.tsx`)
**SINGLE CONTINUOUS SCROLL** (no segmented control). Order:
1. `UnifiedSearchBar` — token / dApp / URL intent.
2. **Trending** strip (horizontal).
3. **Market** — vertical list w/ `Sparkline` + live price + 24h (reclaim `MarketExplorer`). Tap → `TokenDetailModal`.
4. **Apps** — dApp list, on-brand violet icons, category chips. "Open" → in-app browser (chrome untouched).
5. **News** — existing `NewsFeed`.
Fixes: legible `textPrimary` section headers; kill rogue site palette.

### 5.4 Token Detail (`src/features/portfolio/components/TokenDetailModal.tsx`)
Shared destination for every coin tap.
- **Present as bottom-sheet** (convert from centered `Modal`).
- Header (icon + name + symbol + close), large mono price, 24h change, **full 1D/1W/1M/1Y** price chart (market price history — exists for all ranges; the young-wallet tiering is **portfolio-only**, NOT here), stats grid (mkt cap / 24h vol).
- **Testnet-gated action row:** ETH → Buy (Transak) + Send + Receive; non-buyable (USDC/LINK) → Swap replaces Buy. Uses existing `isTokenSwappableOnTestnet` + `useUserHoldsToken`. Never a dead Buy button.

---

## 6. Portfolio value chart — tiered, no seeding (LOCKED)

Portfolio value = Σ(balance@t × price@t) → needs balance history AND price history. A self-custody wallet has no ledger, so tier the chart to data that honestly exists:

- **24h change** = current balances × price-24h-ago (from existing market feed `changePercent24Hr`). **Instant, zero storage.**
- **1D sparkline/line** = current holdings × today's intraday price series (price feed). Instant, no snapshots.
- **1W / 1M / 1Y / ALL** = require **daily total-USD snapshots** (one row/day). Snapshots start silently at first launch; each period unlocks the day it has data. `ALL` = since inception (label with date).
- **$0 wallet** = NO chart; the fund prompt takes its place. Never an empty axis.

**Disabled-period UX (user-specified):** disabled periods are **dimmed tabs — NO lock icon** (reads AI). Tapping one shows a warm one-liner, e.g. *"1Y isn't ready yet — your wallet is 3 days old. Showing since you started for now."*

**Headline %** = deposit-adjusted **value-change** for the selected period (NOT cost-basis P&L — that's deferred/heavier, à la Zerion/Phantom token view). Deposit-adjust the baseline so funding the wallet doesn't read as a gain (Coinbase "Net Invested" / Robinhood model).

**Replace** `usePortfolioHistory` (currently price-only reconstruction — the wrong approach) with the snapshot-backed approach.

**Demo caveat:** snapshots accrue over real days. On a fresh testnet demo, only 1D shows until days pass; longer ranges fill in honestly. Acceptable (or seed snapshots for a demo if needed).

---

## 7. Popular-on-testnet shelf (LOCKED)

- Shows ONLY registry-tradeable coins, **chain-aware** (from `dexRegistry.ts`): ETH + USDC on eth/base/arb-sepolia; **LINK on base-sepolia only**.
- Per-coin action: **ETH → Buy** (Transak — ETH-only; reuses existing `'Buy'` route). **USDC / LINK → Swap** (user holds ETH → swap in; route `navigation.navigate('Dex', { initialTab: 'swap', preselect })`). No browser delegation.
- Kept on BOTH empty and funded Portfolio (keeps the page full + always a next action).
- Market section in Discover = **browse-all + gated actions**: list real-world coins for browsing; tap → detail; actions stay testnet-gated (others are price-only, no dead buttons).

---

## 8. Deferred (not this pass)
- Cost-basis P&L (realized/unrealized) — own project.
- Profile ecosystem redesign (Stream A) — designed later in the same session; ~31→~15 screens, delete dead/mock (ConnectedDevices, legacy Settings, SecurityPrivacy passthrough), gate dev/test UI behind `__DEV__`.
- `text` alias removal (22 refs) — optional.
