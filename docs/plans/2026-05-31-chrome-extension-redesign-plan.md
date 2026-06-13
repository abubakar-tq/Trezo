# Chrome Extension — Featureful Redesign Plan

> Implements the approved mockup at `.design-skills/mockup/index.html`. The extension becomes a real multi-view wallet (MetaMask/Rabby-class) on Trezo's design system, reusing our data. Build in phases; verify each at runtime before the next.

**Design source of truth:** the mockup HTML. Match its layout, spacing, components, and copy. Tokens from `apps/mobile/src/theme/themes.ts` (dark).

**Scope.** IN: sign-in, Home (balance hero + 24h + sparkline; Tokens / Activity / Market tabs), Receive, **Send** (native ETH + ERC-20, gasless UserOp), Settings + connected-sites, redesigned approval windows (Connect/Sign/Tx-with-preview/Result, 420px). OUT (mobile-only, link out): recovery/guardians, deploy, on-ramp/Buy, swap.

**Hard constraints**
- **Keep all working logic** (connect/sign/tx, pairing, multi-chain, device-link). This is a reskin + feature-add, not a rewrite of the RPC/AA layer.
- **Bundle fonts locally** — MV3 CSP blocks Google-Fonts CDN. Add Geist + Geist Mono `woff2` (from the `geist` npm font files or Google Fonts download) under `src/popup/fonts/` and `@font-face` them in `index.css`. No external font/CSS requests.
- **Data = reuse our sources** (all HTTP/Supabase, work in the extension): balances (Moralis, via the same endpoints `PortfolioService` uses), market (`MarketService` CoinCap→Binance), **activity from Supabase `wallet_transactions`** (port `TransactionHistoryService.listForWallet`), sparkline (portfolio history). Reimplement the *queries/fetches* in the extension (the mobile services have RN deps) — do not import RN modules.
- Approval UI stays in the dedicated `chrome.windows.create` window (already done); main popup is the toolbar action popup.

---

## Phase A — Design system + component kit + reskin existing

**Goal:** the extension instantly looks built — tokens, Geist, a component kit, and all *existing* screens (Login, Home shell, Pair, Connect/Sign/Tx/Result sheets) restyled to the mockup. No new data yet.

A1. **Tailwind + tokens + fonts.**
- `tailwind.config.js`: extend `theme.colors` with our tokens (bg `#060608`, surface, card, border, text/2/3, accent `#7C3AED`, accent2 `#06B6D4`, success `#34D399`, warning, danger, glass), `borderRadius`, `fontFamily` (`sans: Geist`, `mono: Geist Mono`).
- `src/popup/index.css`: define `:root` CSS variables (mirror the mockup `:root`), `@font-face` for Geist (400/500/600/700) + Geist Mono (400/500) from bundled `woff2`, base `body` background (radial violet + cyan + ink), the faint grain overlay, and `@tailwind base/components/utilities`. Set the popup width responsive (`html,body{width:100%}` — the window controls size).
- Bundle the `woff2` files under `src/popup/fonts/`.

A2. **Component kit** under `src/popup/ui/` (small, typed, reusable — match mockup styles):
`Logo` (real `icons/icon128.png`), `Button` (variants `primary` gradient / `ghost`), `Card`, `Chip` (chain chip), `IconButton`, `Input`, `Tabs`, `ListRow` (icon + name/sub + right value/change), `TokenIcon` (lettered/gradient circle), `Pill` (ok/warn), `Sheet` (approval shell with titlebar-less window body), `Stat`/`KV`, `BalanceHero`, `EmptyState`, `Spinner`/skeleton. Use Lucide-react is fine (already common) OR inline SVGs from the mockup — prefer inline SVG to avoid a new dep unless lucide-react is already installed (check first).

A3. **Reskin existing views** to the kit + mockup, keeping their logic:
- `LoginScreen` → match the mockup sign-in (logo, "Sign in to Trezo", pill inputs, gradient button, Google social, "Create an account"). Keep `AuthService` calls.
- `HomeScreen` shell → header (logo + `ChainSwitcher` chip + a settings IconButton), keep the per-chain wallet/link logic; the rich body comes in Phase B (for now show the address card + link status in the new style).
- `PairDeviceScreen` → new input/cards/button styles + the chain hint.
- `ConnectSheet`, `SignSheet`, `SignTypedSheet`, `TxConfirmSheet` → restyle to the mockup approval frames (logo, origin row, KV cards, Windows-Hello bio tag, gradient buttons, result view). Keep all approval/WebAuthn/submit logic.
- Widen the approval window to **width 420, height 640** in `approvalManager.ts` (`ensureApprovalWindow`).

**Verify (you):** load unpacked → sign-in, home, and an approval all look like the mockup; Windows Hello dialog no longer clips.

---

## Phase B — Featureful Home (tabs + data)

B1. **Data layer** under `src/data/`:
- `balances.ts` — fetch token balances + USD for `(address, chainId)`. Inspect `apps/mobile/src/features/portfolio/services/PortfolioService.ts` + `useWalletData`/`PriceProvider` to find the source (Moralis endpoint + price source) and reimplement the fetch with `fetch` (read the Moralis API key from `apps/mobile/.env` → add `VITE_MORALIS_API_KEY` to `.env.local`). Return `{ totalUsd, tokens: [{symbol,name,amount,priceUsd,valueUsd,change24h?,address,decimals,iconKey}] }`.
- `market.ts` — port `MarketService` (CoinCap primary → Binance fallback) → `getTopAssets(n)` → `[{symbol,name,priceUsd,change24h,spark?}]`.
- `activity.ts` — port `TransactionHistoryService.listForWallet` query against Supabase `wallet_transactions` using the extension's `supabase` client: `listForWallet({walletAddress, chainId, limit})` → typed rows (type, status, direction, token_symbol, amount_display, transaction_hash, user_op_hash, paymaster_used, created_at). NO chain refetch.
- `change24h.ts` — join holdings to market by symbol for the portfolio 24h % (port `computeTotalChange24h` from `home/utils/portfolio24h.ts`).

B2. **Home body** (matching mockup):
- `BalanceHero` — total USD, 24h % pill, sparkline (1D series; if unavailable, hide gracefully).
- Quick actions row: Receive · Send · Activity.
- `Tabs`: **Tokens** (token ListRows w/ TokenIcon, amount, USD, 24h) · **Activity** (Supabase rows w/ direction icon, status, amount, relative time → click → explorer) · **Market** (top assets w/ price, mini-spark, 24h).
- Empty states (no funds / no activity) per the redesign-skill (composed, not blank).
- Per-chain "Link this device on {chain}" banner when unlinked (existing logic).

**Verify (you):** Home shows real balance, your tokens, your Supabase activity, and live market.

---

## Phase C — Receive · Send · Settings

C1. **Receive** — chain-aware: QR (use a tiny QR lib — check if one's installed, else `qrcode` or render via an API-free generator) + address + copy button + chain label.

C2. **Send** (build it):
- Form: recipient address (validate), asset picker (native ETH + the wallet's ERC-20s from `balances.ts`), amount (with max), review.
- Build the UserOp: native → `prepareDappTx({to: recipient, value, data:'0x'})`; ERC-20 → `to: token, value:0, data: encodeFunctionData(erc20 transfer)`. Reuse `core/smartAccountExecution.ts` (chain-correct, gasless). Sign in the approval window via WebAuthn, submit, show the result view.
- **Record to Supabase** `wallet_transactions` (insert a row mirroring `TransactionHistoryService.createDraft`→`markConfirmed` shape) so it appears in Activity. Keep it minimal but consistent with the table columns.
- Device-link guard before sending (like sign/tx).

C3. **Settings + connected sites** — list connected origins (from `sessionStore`) with per-site disconnect + "Disconnect all"; Networks list; Lock wallet (sign out); "Recovery & guardians — managed in the Trezo mobile app" (external note); About.

**Verify (you):** receive shows QR+address; a Send goes through gaslessly and then appears in Activity; settings disconnect works.

---

## Sequencing
1. **Phase A** (one or two Sonnet agents) → you verify the new look.
2. **Phase B** (data agent, then Home-UI agent) → you verify data.
3. **Phase C** (Receive/Settings agent; Send agent) → you verify Send + receive.

Each agent: worktree root, no `npm install` (resolve up), no Co-Authored-By trailer, `npm run -w apps/extension build` must pass, match the mockup, keep working logic intact.
