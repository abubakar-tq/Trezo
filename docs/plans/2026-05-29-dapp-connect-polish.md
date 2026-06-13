# In-app dApp Connection — Detection + Browser UX Polish (design)

**Date:** 2026-05-29
**Branch:** `feat/dapp-connect` (off `feat/mobile-polish-pass`)
**Builds on:** [`2026-05-11-dapp-session-model.md`](./2026-05-11-dapp-session-model.md), [ADR-0002](../adr/0002-dapp-sendtransaction-returns-userophash.md)

## Problem

The in-app browser's dApp connection (injected EIP-1193 provider, RPC router, approval sheets, sessions) is functionally complete, but two issues block a good experience:

1. **Wallet not detected.** Opening Uniswap in the in-app browser and tapping *Connect* shows WalletConnect / Coinbase / Binance — never "Trezo." Modern dApps discover wallets via **EIP-6963** (multi-injected provider discovery), not the legacy `window.ethereum` global. Our injected script only sets `window.ethereum`, so EIP-6963 dApps never list us.
2. **Browser chrome feels like "mini-Chrome," not a web3 wallet browser.** The page is pinched inside a rounded card with margins; an always-on tab-pill strip and a separate URL bar consume vertical space; sites render white even when the app is in dark theme.

## Goals

- dApps detect **"Trezo (Detected)"** and connect straight into the existing `ApproveConnectionSheet` — no WalletConnect detour.
- A clean, **full-bleed, themed, Phantom-style** in-app browser.
- Test coverage for the dApp RPC layer (currently zero).

## Non-goals (deferred)

- **WalletConnect v2 / external-browser connection** — Phase 2 (relay, pairing, session lifecycle). The EIP-6963 fix resolves the detection problem on its own.
- Per-method permission granularity, session expiry, multi-account selection — unchanged from the v1 session model.

---

## Part A — Wallet detection via EIP-6963

**File:** `apps/mobile/src/features/browser/web/injectedProvider.template.ts`

The injected script keeps building the EIP-1193 provider, then additionally implements **EIP-6963**:

- Define a stable provider `info` object:
  ```js
  var info = {
    uuid: (crypto.randomUUID ? crypto.randomUUID() : fallbackUuid()),
    name: "Trezo",
    rdns: "com.trezo.wallet",          // matches app.config.ts bundleIdentifier
    icon: "data:image/png;base64,…"    // small (~96px) Trezo mark, generated from assets/images/icon_nobackground.png
  };
  ```
- `announce()` dispatches `new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: info, provider: window.ethereum }) })`.
- Call `announce()` once on init, and register `window.addEventListener("eip6963:requestProvider", announce)` so late-mounting dApp discovery (Uniswap re-requests) still finds us.
- **Remove** the `if (window.ethereum) return;` early-bail. Always register our provider (we are the only wallet in the in-app WebView). Keep `isTrezo: true`.
- The `icon` data-URI is produced by a build/generation step into a constant (do **not** hand-paste a huge string); keep it small to keep the injected script lightweight.

**Acceptance:** In the in-app browser, Uniswap's connect modal lists "Trezo (Detected)"; tapping it opens `ApproveConnectionSheet` and, on approve, returns the account — the existing `eth_requestAccounts` path.

---

## Part B — Browser chrome rebuild

**File:** `apps/mobile/src/features/browser/screens/BrowserScreen.tsx` plus new components under `apps/mobile/src/features/browser/components/`.

### Layout
- **Full-bleed page:** remove the `webShell` `marginHorizontal`/`borderRadius`/`borderWidth` (BrowserScreen styles ~691–697). The WebView fills the screen width and the area between the slim top bar and the app's bottom tab bar.
- **Remove** the always-on tab-pill strip (`tabStrip` + `TabPill`).

### `BrowserTopBar` (new component)
A single slim row:
- `‹` **back** — shown only when `canGoBack`.
- Centered **domain pill**: lock icon (themed by `isUrl`/https) + **hostname** (not full URL). Tapping expands it to an editable full-URL field with a clear (`✕`) button; submitting navigates. On home/new-tab, it's a "Search or enter address" field.
- **Tab-count button** — shows `tabs.length`; opens the existing `TabSwitcherModal`.
- **`⋯` menu button** — opens `BrowserMenuSheet`.

### `BrowserMenuSheet` (new bottom sheet)
- Header: site favicon + title + **connection status** — `🟢 Connected · <hostname>` when `useDAppSessionsStore.findSession(origin)` exists, else `Not connected`.
- Actions: **Reload**, **Forward** (enabled when `canGoForward`), **Copy link**, **Share**, **New tab**, **Disconnect dApp** (when connected — removes the session, mirrors the existing disconnect semantics), **Browser settings** (navigates to existing `BrowserSettingsScreen`).

### State
- Reuse `useBrowserStore` (tabs/history/settings) and `useDAppSessionsStore` (sessions). Add only transient UI state for the URL-edit toggle and menu visibility (local component state; no store changes required beyond what exists).

**Acceptance:** Page is edge-to-edge; the top bar shows back/domain/tab-count/menu only; reload/forward/copy/share/connection live in the menu; tab-count opens the switcher.

---

## Theme handling (WebView)

**File:** `BrowserScreen.tsx` WebView + its container.

1. **Always (guaranteed):** set the WebView and its container `backgroundColor` to `theme.colors.background`. Eliminates the white load-flash and frames the page in the app theme. Resolves the dark-app/white-site mismatch the user reported.
2. **Best-effort `prefers-color-scheme`** following `resolvedMode` (`light`/`dark`, from `ThemeProvider`):
   - **iOS:** set `overrideUserInterfaceStyle={resolvedMode}` on the WebView so WKWebView reports the matching scheme; theme-aware sites (Uniswap, Aave) switch.
   - **Android:** drive `react-native-webview`'s dark setting from `resolvedMode`.
3. **Non-dark sites while app is dark:** leave the site in its native (light) colors — **no force/algorithmic darkening** (it breaks branded/image-heavy pages). The dark chrome + no-flash still make it feel intentional. This matches Phantom.

> Theme matching means *the browser follows the app*: light app → light sites (a white site is a correct match), dark app → dark where the site supports it. The original bug was the *mismatch* (dark app, forced-white site), fixed by (1) + (2).

---

## Tests (this round)

**File(s):** `apps/mobile/src/features/browser/**/__tests__` (follow the app's existing test setup).

- **`rpcRouter`** — per method: `eth_requestAccounts` (approve → session + `[address]`; deny → 4001), `eth_accounts` (session → `[address]`, none → `[]`), `eth_chainId`, `personal_sign`, `eth_signTypedData_v4`, `eth_sendTransaction` (activation gating, returns userOpHash per ADR-0002), `wallet_switchEthereumChain`, `wallet_addEthereumChain` → 4902, unknown method → -32601.
- **`useDAppSessionsStore`** — `addSession` (upsert), `removeSession`, `touch` (`lastUsedAt`), `updateSessionChain`, `findSession`, AsyncStorage persistence under `trezo_dapp_sessions_v1`.
- **EIP-6963** — the provider `info` object has the correct shape (`uuid`, `name`, `rdns: "com.trezo.wallet"`, `icon` data-URI), and the injected script wires `announce()` + the `eip6963:requestProvider` listener.

---

## Files touched (summary)

| File | Change |
|---|---|
| `web/injectedProvider.template.ts` | EIP-6963 announce + provider info; drop early-bail |
| `web/trezoProviderIcon.ts` (new) | generated base64 icon data-URI constant |
| `screens/BrowserScreen.tsx` | full-bleed page, theme wiring, wire new bar/menu |
| `components/BrowserTopBar.tsx` (new) | slim bar (back/domain/tabs/menu) |
| `components/BrowserMenuSheet.tsx` (new) | `⋯` menu incl. connection status/disconnect |
| `**/__tests__/*` (new) | rpcRouter, sessions store, EIP-6963 tests |

## Risks / open questions

- `prefers-color-scheme` override reliability differs across OS/WebView versions — treated as best-effort; the container background is the guaranteed win.
- Confirm `react-native-webview@13.15` Android dark-mode prop during implementation (it has shifted across versions); fall back to the container-bg + injected `color-scheme` meta if the prop is unavailable.
- Keep the EIP-6963 `icon` data-URI small to avoid bloating the injected script string.
- The app currently has near-zero test coverage — confirm a test runner (`jest` / `jest-expo`) is configured. If not, minimal test-harness setup is part of the tests deliverable (scope it in the implementation plan).

## Acceptance criteria (round)

1. Uniswap (and another EIP-6963 dApp) shows **"Trezo (Detected)"** and connects via the existing approval flow on Base Sepolia.
2. Browser page is full-bleed; chrome is the slim bar + `⋯` menu; tab-count opens the switcher; menu surfaces connection status + disconnect.
3. No white flash; dark app → dark on theme-aware sites; light app → light sites look correct.
4. New tests pass for `rpcRouter`, `useDAppSessionsStore`, and the EIP-6963 announce.
