# In-app dApp Connection Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-app-browsed dApps detect "Trezo" directly (via EIP-6963) and connect through the existing approval flow, and rebuild the browser chrome into a clean, full-bleed, themed, Phantom-style UI.

**Architecture:** Two parts. **(A) Detection** — the injected WebView script keeps its EIP-1193 provider but additionally implements EIP-6963 (announce + `requestProvider` listener) so modern dApps list us. **(B) Chrome** — replace the tab-pill strip + bolted-on URL bar + pinched card with a slim `BrowserTopBar` and a `BrowserMenuSheet`, give the WebView the app's background color, and hint `prefers-color-scheme`. Along the way, two small dependency-injection refactors make the RPC router and session logic unit-testable under the repo's existing runner.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript (strict), `react-native-webview@13.15`, Zustand + AsyncStorage, `@gorhom/bottom-sheet`, `viem`. Tests are plain `tsx`-runnable assertion scripts (the repo has **no jest** — see Testing Conventions).

---

## Testing Conventions (read first)

This repo does **not** use jest. The existing tests (`src/integration/viem/__tests__/recoveryHash.test.ts`, `src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts`) are plain TypeScript scripts that:

- use hand-rolled `assert` / `assertEqual` helpers (no `describe`/`it`/`expect`),
- use **relative imports only** (the runner is `tsx`/esbuild, which does **not** resolve the `@/…` path aliases at runtime),
- `console.log("OK …")` on success and `process.exit(1)` / `throw` on failure,
- run via **`npx tsx <file>`** from the `apps/mobile` directory.

`tsx` **cannot** load modules that transitively import `react-native` or `expo-constants` (it throws a `TransformError` on React Native's flow-typed source). This is why `rpcRouter.ts` and the session store must be refactored to push their native dependencies out of the unit under test. Confirmed facts:

- `npx tsx src/integration/viem/__tests__/recoveryHash.test.ts` → exits 0 (runner works).
- `import('./src/integration/chains.ts')` under `tsx` → fails (pulls in `react-native`/`expo-constants`).

All new tests in this plan follow the existing style: relative imports, hand-rolled asserts, `npx tsx` run command. `import type { … }` is erased by `tsx` before resolution, so type-only imports may keep `@/…` aliases.

**Run command (all from `apps/mobile/`):** `npx tsx <relative-path-to-test>`

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `src/features/browser/web/trezoProviderIcon.ts` | The EIP-6963 icon as a small base64 SVG data-URI constant. |
| `src/features/browser/utils/url.ts` | `getHostname(url)` — pure URL→hostname helper for the address pill. |
| `src/features/browser/store/sessionOps.ts` | Pure session-array reducers (upsert/remove/touch/updateChain/find), extracted from the store for testability. |
| `src/features/browser/components/BrowserTopBar.tsx` | Slim top bar: back ‹ · domain pill (tap-to-edit) · tab-count · ⋯ menu. Presentational. |
| `src/features/browser/components/BrowserMenuSheet.tsx` | `⋯` bottom sheet: connection status + Reload/Forward/Copy/Share/New tab/Disconnect/Settings. |
| `src/features/browser/web/__tests__/injectedProvider.template.test.ts` | Asserts provider identity constants + EIP-6963 wiring in the injected script. |
| `src/features/browser/web/__tests__/rpcRouter.test.ts` | Per-method `handleRPC` behavior. |
| `src/features/browser/store/__tests__/sessionOps.test.ts` | Session reducer behavior. |
| `src/features/browser/utils/__tests__/url.test.ts` | `getHostname` behavior. |

**Modified files**

| File | Change |
|---|---|
| `src/features/browser/web/injectedProvider.template.ts` | Add EIP-6963 announce + `requestProvider` listener + uuid fallback; drop the `if (window.ethereum) return;` early-bail; export `TREZO_PROVIDER_NAME`/`TREZO_PROVIDER_RDNS`. |
| `src/features/browser/web/rpcRouter.ts` | Dependency-inject `defaultChainId` / `findSession` / `touchSession` via `RPCContext`; remove direct store + chains value imports. |
| `src/features/browser/store/useDAppSessionsStore.ts` | Delegate state logic to `sessionOps`. |
| `src/features/browser/screens/BrowserScreen.tsx` | Full-bleed layout; wire `BrowserTopBar` + `BrowserMenuSheet`; themed WebView background + `prefers-color-scheme` injection; supply the new RPC context fields; remove `TabPill`/`NavBtn`/tab-strip/URL-bar. |
| `apps/mobile/package.json` | Add a `test:dapp` convenience script. |

---

## Task 1: EIP-6963 detection — provider identity + announce

**Files:**
- Create: `apps/mobile/src/features/browser/web/trezoProviderIcon.ts`
- Modify: `apps/mobile/src/features/browser/web/injectedProvider.template.ts`
- Test: `apps/mobile/src/features/browser/web/__tests__/injectedProvider.template.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/browser/web/__tests__/injectedProvider.template.test.ts`:

```ts
import {
  INJECTED_PROVIDER_SCRIPT,
  TREZO_PROVIDER_NAME,
  TREZO_PROVIDER_RDNS,
} from "../injectedProvider.template";
import { TREZO_PROVIDER_ICON } from "../trezoProviderIcon";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

function run(): void {
  // Provider identity
  assert(TREZO_PROVIDER_NAME === "Trezo", "name is Trezo");
  assert(TREZO_PROVIDER_RDNS === "com.trezo.wallet", "rdns matches app bundle id");
  assert(TREZO_PROVIDER_ICON.startsWith("data:image/"), "icon is a data URI");

  // EIP-6963 wiring present in the injected script
  assert(INJECTED_PROVIDER_SCRIPT.includes("eip6963:announceProvider"), "announces via eip6963");
  assert(INJECTED_PROVIDER_SCRIPT.includes("eip6963:requestProvider"), "listens for requestProvider");
  assert(INJECTED_PROVIDER_SCRIPT.includes('name: "Trezo"'), "interpolates name");
  assert(INJECTED_PROVIDER_SCRIPT.includes('rdns: "com.trezo.wallet"'), "interpolates rdns");
  assert(INJECTED_PROVIDER_SCRIPT.includes('icon: "data:image/'), "interpolates icon data URI");

  // Legacy provider kept, but the old early-bail is gone
  assert(INJECTED_PROVIDER_SCRIPT.includes("isTrezo: true"), "keeps isTrezo flag");
  assert(!INJECTED_PROVIDER_SCRIPT.includes("if (window.ethereum) return;"), "early-bail removed");

  console.log("OK injectedProvider.template");
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/mobile/`): `npx tsx src/features/browser/web/__tests__/injectedProvider.template.test.ts`
Expected: FAIL — `Cannot find module '../trezoProviderIcon'` (and missing `TREZO_PROVIDER_NAME`/`TREZO_PROVIDER_RDNS` exports).

- [ ] **Step 3: Create the icon constant**

Create `apps/mobile/src/features/browser/web/trezoProviderIcon.ts`:

```ts
// EIP-6963 provider icon. A small inline SVG (violet rounded square + "T" mark in
// ivory — the Trezo brand accent #7C3AED on #F4F1EA), base64-encoded as a data URI.
// Base64 is used (not raw/url-encoded SVG) so the string contains no quotes, backticks,
// or `${` that would break the template literal it is interpolated into.
//
// Source SVG (96x96):
//   <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
//     <rect width="96" height="96" rx="22" fill="#7C3AED"/>
//     <path d="M26 30h44v10H52v36h-12V40H26z" fill="#F4F1EA"/>
//   </svg>
export const TREZO_PROVIDER_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDk2IDk2Ij48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHJ4PSIyMiIgZmlsbD0iIzdDM0FFRCIvPjxwYXRoIGQ9Ik0yNiAzMGg0NHYxMEg1MnYzNmgtMTJWNDBIMjZ6IiBmaWxsPSIjRjRGMUVBIi8+PC9zdmc+";
```

- [ ] **Step 4: Rewrite the injected provider template**

Replace the **entire** contents of `apps/mobile/src/features/browser/web/injectedProvider.template.ts` with:

```ts
// String injected into the WebView via react-native-webview's injectedJavaScriptBeforeContentLoaded.
// Must be ES5-compatible — runs in arbitrary dApp environments. Self-contained.

import { TREZO_PROVIDER_ICON } from "./trezoProviderIcon";

// Provider identity (EIP-6963). rdns matches app.config.ts bundleIdentifier.
export const TREZO_PROVIDER_NAME = "Trezo";
export const TREZO_PROVIDER_RDNS = "com.trezo.wallet";

export const INJECTED_PROVIDER_SCRIPT = `
(function () {
  var pending = {};
  function rid() { return Math.random().toString(36).slice(2) + Date.now(); }
  function uuidv4() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function send(method, params) {
    return new Promise(function (resolve, reject) {
      var id = rid();
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "rpc", id: id, method: method, params: params }));
    });
  }

  var listeners = {};

  var provider = {
    isTrezo: true,
    isMetaMask: false,
    request: function (req) { return send(req.method, req.params || []); },
    on: function (event, cb) {
      (listeners[event] = listeners[event] || []).push(cb);
    },
    removeListener: function (event, cb) {
      listeners[event] = (listeners[event] || []).filter(function (x) { return x !== cb; });
    },
    enable: function () { return send("eth_requestAccounts", []); },
    sendAsync: function (req, cb) {
      send(req.method, req.params || []).then(
        function (result) { cb(null, { id: req.id, jsonrpc: "2.0", result: result }); },
        function (err) { cb(err, null); }
      );
    },
  };

  // Legacy injection — kept for dApps that still read window.ethereum directly.
  // Guarded: some sites pre-define a non-writable window.ethereum; if assignment throws
  // we swallow it and rely on EIP-6963 (which does not touch window.ethereum at all).
  try { window.ethereum = provider; } catch (e) {}

  // EIP-6963 multi-injected provider discovery — how modern dApps (Uniswap, etc.) list wallets.
  var info = {
    uuid: uuidv4(),
    name: "${TREZO_PROVIDER_NAME}",
    rdns: "${TREZO_PROVIDER_RDNS}",
    icon: "${TREZO_PROVIDER_ICON}"
  };
  function announce() {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: info, provider: provider })
    }));
  }
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  document.addEventListener("trezo:rpc-response", function (ev) {
    var msg = ev.detail;
    var p = pending[msg.id];
    if (!p) return;
    delete pending[msg.id];
    if (msg.error) p.reject(msg.error);
    else p.resolve(msg.result);
  });

  document.addEventListener("trezo:event", function (ev) {
    var msg = ev.detail;
    (listeners[msg.event] || []).forEach(function (cb) { try { cb(msg.data); } catch (e) {} });
  });

  window.dispatchEvent(new Event("ethereum#initialized"));
})();
true;
`;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx src/features/browser/web/__tests__/injectedProvider.template.test.ts`
Expected: PASS — prints `OK injectedProvider.template`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/browser/web/trezoProviderIcon.ts \
        apps/mobile/src/features/browser/web/injectedProvider.template.ts \
        apps/mobile/src/features/browser/web/__tests__/injectedProvider.template.test.ts
git commit -m "feat(browser): announce Trezo via EIP-6963 for in-app dApp detection"
```

---

## Task 2: Make `rpcRouter` testable (dependency injection)

The router currently imports the sessions store and `DEFAULT_CHAIN_ID` directly, which pulls native modules into the unit and blocks `tsx` testing. Inject those as `RPCContext` fields instead. This is the red→green: the test fails first because importing the current router pulls in `react-native`.

**Files:**
- Modify: `apps/mobile/src/features/browser/web/rpcRouter.ts`
- Modify: `apps/mobile/src/features/browser/screens/BrowserScreen.tsx` (minimal wiring only — full rebuild is Task 7)
- Test: `apps/mobile/src/features/browser/web/__tests__/rpcRouter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/browser/web/__tests__/rpcRouter.test.ts`:

```ts
import { handleRPC, type RPCContext, type RPCMessage } from "../rpcRouter";
import type { DAppSession } from "../../store/useDAppSessionsStore";

// respondToRPC injects exactly: PREFIX + JSON.stringify(payload) + SUFFIX
const PREFIX = 'document.dispatchEvent(new CustomEvent("trezo:rpc-response", { detail: ';
const SUFFIX = " })); true;";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}
function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

type Captured = { result?: unknown; error?: { code: number; message: string } };

const SESSION: DAppSession = {
  id: "s1",
  origin: "https://app.uniswap.org",
  accountAddress: "0xabc0000000000000000000000000000000000001",
  chainId: 84532,
  approvedAt: "t",
  lastUsedAt: "t",
};

function makeCtx(
  overrides: Partial<RPCContext> & { sessionForOrigin?: DAppSession | null } = {},
) {
  const injected: string[] = [];
  const touched: string[] = [];
  const webview = {
    injectJavaScript: (s: string) => {
      injected.push(s);
    },
  } as unknown as RPCContext["webview"];
  const session = overrides.sessionForOrigin ?? null;
  const ctx: RPCContext = {
    webview,
    origin: "https://app.uniswap.org",
    defaultChainId: 84532,
    findSession: () => session,
    touchSession: (o) => {
      touched.push(o);
    },
    requestApproval: async () => null,
    requestSignMessage: async () => null,
    requestSignTypedData: async () => null,
    requestSendTransaction: async () => null,
    requestSwitchChain: async () => false,
    ...overrides,
  };
  const decode = (): Captured => {
    const last = injected[injected.length - 1];
    const json = last.slice(PREFIX.length, last.length - SUFFIX.length);
    return JSON.parse(json) as Captured;
  };
  return { ctx, injected, touched, decode };
}

function msg(method: string, params: unknown[] = []): RPCMessage {
  return { type: "rpc", id: "1", method, params };
}

async function run(): Promise<void> {
  // eth_requestAccounts — existing session returns address without prompting
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().result, [SESSION.accountAddress], "requestAccounts returns session address");
  }
  // eth_requestAccounts — no session, approval granted
  {
    const approved = { ...SESSION, id: "s2" };
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, requestApproval: async () => approved });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().result, [approved.accountAddress], "requestAccounts returns approved address");
  }
  // eth_requestAccounts — denied -> 4001
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, requestApproval: async () => null });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().error?.code, 4001, "denied connect -> 4001");
  }
  // eth_accounts — no session -> []
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null });
    await handleRPC(ctx, msg("eth_accounts"));
    assertEqual(decode().result, [], "eth_accounts empty without session");
  }
  // eth_chainId — falls back to defaultChainId hex when no session (84532 -> 0x14a34)
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, defaultChainId: 84532 });
    await handleRPC(ctx, msg("eth_chainId"));
    assertEqual(decode().result, "0x14a34", "chainId hex for 84532");
  }
  // personal_sign — unauthorized without session -> 4100
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null });
    await handleRPC(ctx, msg("personal_sign", ["0xdead"]));
    assertEqual(decode().error?.code, 4100, "personal_sign unauthorized -> 4100");
  }
  // personal_sign — signed -> returns sig, touches session
  {
    const { ctx, decode, touched } = makeCtx({
      sessionForOrigin: SESSION,
      requestSignMessage: async () => "0xsig" as `0x${string}`,
    });
    await handleRPC(ctx, msg("personal_sign", ["0xdead"]));
    assertEqual(decode().result, "0xsig", "personal_sign returns signature");
    assertEqual(touched.length, 1, "personal_sign touches session");
  }
  // eth_signTypedData_v4 — signed -> returns sig
  {
    const { ctx, decode } = makeCtx({
      sessionForOrigin: SESSION,
      requestSignTypedData: async () => "0xtyped" as `0x${string}`,
    });
    await handleRPC(ctx, msg("eth_signTypedData_v4", ["0xaddr", "{}"]));
    assertEqual(decode().result, "0xtyped", "signTypedData returns signature");
  }
  // eth_sendTransaction — signed -> returns userOpHash
  {
    const { ctx, decode } = makeCtx({
      sessionForOrigin: SESSION,
      requestSendTransaction: async () => "0xuserop" as `0x${string}`,
    });
    await handleRPC(ctx, msg("eth_sendTransaction", [{ to: "0x01" }]));
    assertEqual(decode().result, "0xuserop", "sendTransaction returns userOpHash");
  }
  // wallet_switchEthereumChain — ok -> null
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION, requestSwitchChain: async () => true });
    await handleRPC(ctx, msg("wallet_switchEthereumChain", [{ chainId: "0x14a34" }]));
    assertEqual(decode().result, null, "switchChain ok -> null");
  }
  // wallet_switchEthereumChain — rejected -> 4902
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION, requestSwitchChain: async () => false });
    await handleRPC(ctx, msg("wallet_switchEthereumChain", [{ chainId: "0x1" }]));
    assertEqual(decode().error?.code, 4902, "switchChain rejected -> 4902");
  }
  // unknown method (incl. wallet_addEthereumChain) -> -32601
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION });
    await handleRPC(ctx, msg("wallet_addEthereumChain", [{}]));
    assertEqual(decode().error?.code, -32601, "addEthereumChain unsupported -> -32601");
  }
  console.log("OK rpcRouter");
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

> Note: this corrects the spec's test bullet — `wallet_addEthereumChain` is **not** a handled case; it falls through to `default` → `-32601`. The test asserts the real behavior.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/features/browser/web/__tests__/rpcRouter.test.ts`
Expected: FAIL — `tsx` errors importing `react-native` (a `TransformError`), because `rpcRouter.ts` currently imports `DEFAULT_CHAIN_ID` from `@/src/integration/chains` and the value of `useDAppSessionsStore` (→ AsyncStorage / react-native).

- [ ] **Step 3: Refactor the router to inject its dependencies**

In `apps/mobile/src/features/browser/web/rpcRouter.ts`, change the imports. Remove these two **value** imports:

```ts
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import { DEFAULT_CHAIN_ID } from "@/src/integration/chains";
```

Keep the type-only import (`import type { DAppSession } from "@features/browser/store/useDAppSessionsStore";`) and the `respondToRPC` / `WebView` imports.

Then extend `RPCContext` — add the three injected fields right after `origin`:

```ts
export type RPCContext = {
  webview: WebView | null;
  origin: string;
  defaultChainId: number;
  findSession: (origin: string) => DAppSession | null;
  touchSession: (origin: string) => void;
  requestApproval: (origin: string, chainId: number) => Promise<DAppSession | null>;
  requestSignMessage: (origin: string, hexMessage: string) => Promise<`0x${string}` | null>;
  requestSignTypedData: (origin: string, typedData: unknown) => Promise<`0x${string}` | null>;
  requestSendTransaction: (
    origin: string,
    tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
  ) => Promise<`0x${string}` | null>;
  requestSwitchChain: (origin: string, chainId: number) => Promise<boolean>;
};
```

In `handleRPC`, replace the store/default-chain lookups. Change the top of the function from:

```ts
export async function handleRPC(ctx: RPCContext, msg: RPCMessage): Promise<void> {
  const { webview, origin } = ctx;
  const store = useDAppSessionsStore.getState();
  const session = store.findSession(origin);
```

to:

```ts
export async function handleRPC(ctx: RPCContext, msg: RPCMessage): Promise<void> {
  const { webview, origin } = ctx;
  const session = ctx.findSession(origin);
```

Then, within the switch body, replace the three remaining references:
- `DEFAULT_CHAIN_ID` (appears in `eth_requestAccounts` and `eth_chainId`) → `ctx.defaultChainId`
- `store.touchSession(origin)` (in `personal_sign`, `eth_signTypedData_v4`, `eth_sendTransaction`) → `ctx.touchSession(origin)`

After this, `rpcRouter.ts` has no runtime native imports.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/features/browser/web/__tests__/rpcRouter.test.ts`
Expected: PASS — prints `OK rpcRouter`.

- [ ] **Step 5: Keep the app compiling — wire the new fields in BrowserScreen**

`BrowserScreen.tsx` builds the `RPCContext` inline; the new required fields must be supplied or TypeScript fails. (Task 7 rewrites this file fully; this is the minimal interim edit.)

First, add `DEFAULT_CHAIN_ID` to the existing chains import (around line 56). Change:

```ts
import { getChainConfig, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";
```

to:

```ts
import { DEFAULT_CHAIN_ID, getChainConfig, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";
```

Then, in the `handleRPC({ … })` call inside `onMessage` (around line 311), insert the three fields immediately after `origin,`:

```ts
                  handleRPC(
                    {
                      webview,
                      origin,
                      defaultChainId: DEFAULT_CHAIN_ID,
                      findSession: (o) => useDAppSessionsStore.getState().findSession(o),
                      touchSession: (o) => useDAppSessionsStore.getState().touchSession(o),
                      requestApproval: async (o, chainId) => {
```

(Leave the rest of the context object unchanged.)

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `rpcRouter.ts` / `BrowserScreen.tsx`.

```bash
git add apps/mobile/src/features/browser/web/rpcRouter.ts \
        apps/mobile/src/features/browser/screens/BrowserScreen.tsx \
        apps/mobile/src/features/browser/web/__tests__/rpcRouter.test.ts
git commit -m "refactor(browser): inject session+chain deps into rpcRouter; add unit tests"
```

---

## Task 3: Extract pure session reducers + tests

**Files:**
- Create: `apps/mobile/src/features/browser/store/sessionOps.ts`
- Modify: `apps/mobile/src/features/browser/store/useDAppSessionsStore.ts`
- Test: `apps/mobile/src/features/browser/store/__tests__/sessionOps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/browser/store/__tests__/sessionOps.test.ts`:

```ts
import {
  upsertSession,
  removeSession,
  touchSession,
  updateSessionChain,
  findSession,
} from "../sessionOps";
import type { DAppSession } from "../useDAppSessionsStore";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}
function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

const A = "https://app.uniswap.org";
const B = "https://app.aave.com";
const ADDR = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function run(): void {
  // upsert adds a new session with id + timestamps
  let acc = upsertSession([], { origin: A, accountAddress: ADDR, chainId: 84532 }, "id1", "t0");
  let sessions: DAppSession[] = acc.sessions;
  assertEqual(sessions.length, 1, "one session after first upsert");
  assertEqual(acc.session.id, "id1", "id assigned");
  assertEqual(acc.session.approvedAt, "t0", "approvedAt set");
  assertEqual(acc.session.lastUsedAt, "t0", "lastUsedAt set");

  // upsert same origin replaces (no duplicate), keeps newest chainId
  acc = upsertSession(sessions, { origin: A, accountAddress: ADDR, chainId: 1 }, "id2", "t1");
  sessions = acc.sessions;
  assertEqual(sessions.length, 1, "upsert same origin replaces");
  assertEqual(findSession(sessions, A)?.chainId, 1, "replacement keeps newest chainId");

  // second origin coexists
  acc = upsertSession(sessions, { origin: B, accountAddress: ADDR, chainId: 84532 }, "id3", "t2");
  sessions = acc.sessions;
  assertEqual(sessions.length, 2, "two distinct origins");

  // findSession
  assert(findSession(sessions, A) !== null, "find A");
  assertEqual(findSession(sessions, "https://nope.xyz"), null, "missing origin -> null");

  // touchSession updates only the matching origin's lastUsedAt
  const touched = touchSession(sessions, A, "t9");
  assertEqual(findSession(touched, A)?.lastUsedAt, "t9", "touch updates lastUsedAt");
  assertEqual(findSession(touched, B)?.lastUsedAt, "t2", "touch leaves others");

  // updateSessionChain bumps chain + lastUsedAt
  const chained = updateSessionChain(sessions, B, 11155111, "t10");
  assertEqual(findSession(chained, B)?.chainId, 11155111, "chain updated");
  assertEqual(findSession(chained, B)?.lastUsedAt, "t10", "chain update bumps lastUsedAt");

  // removeSession
  const removed = removeSession(sessions, A);
  assertEqual(removed.length, 1, "remove drops one");
  assertEqual(findSession(removed, A), null, "removed origin gone");

  console.log("OK sessionOps");
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/features/browser/store/__tests__/sessionOps.test.ts`
Expected: FAIL — `Cannot find module '../sessionOps'`.

- [ ] **Step 3: Create the pure reducers**

Create `apps/mobile/src/features/browser/store/sessionOps.ts`:

```ts
import type { DAppSession } from "./useDAppSessionsStore";

export type NewSessionInput = Omit<DAppSession, "id" | "approvedAt" | "lastUsedAt">;

export function upsertSession(
  sessions: DAppSession[],
  input: NewSessionInput,
  id: string,
  now: string,
): { sessions: DAppSession[]; session: DAppSession } {
  const session: DAppSession = { id, approvedAt: now, lastUsedAt: now, ...input };
  // Upsert: replace any existing session for this origin.
  const next = [...sessions.filter((x) => x.origin !== input.origin), session];
  return { sessions: next, session };
}

export function removeSession(sessions: DAppSession[], origin: string): DAppSession[] {
  return sessions.filter((x) => x.origin !== origin);
}

export function touchSession(sessions: DAppSession[], origin: string, now: string): DAppSession[] {
  return sessions.map((x) => (x.origin === origin ? { ...x, lastUsedAt: now } : x));
}

export function updateSessionChain(
  sessions: DAppSession[],
  origin: string,
  chainId: number,
  now: string,
): DAppSession[] {
  return sessions.map((x) => (x.origin === origin ? { ...x, chainId, lastUsedAt: now } : x));
}

export function findSession(sessions: DAppSession[], origin: string): DAppSession | null {
  return sessions.find((x) => x.origin === origin) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/features/browser/store/__tests__/sessionOps.test.ts`
Expected: PASS — prints `OK sessionOps`.

- [ ] **Step 5: Delegate the store to the reducers**

In `apps/mobile/src/features/browser/store/useDAppSessionsStore.ts`, add the import after the existing ones:

```ts
import * as ops from "./sessionOps";
```

Replace the store body (the object returned by the `persist((set, get) => ({ … }))` factory — currently lines ~26–54) with:

```ts
    (set, get) => ({
      sessions: [],
      addSession: (s) => {
        const now = new Date().toISOString();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { sessions, session } = ops.upsertSession(get().sessions, s, id, now);
        set({ sessions });
        return session;
      },
      removeSession: (origin) => set({ sessions: ops.removeSession(get().sessions, origin) }),
      touchSession: (origin) =>
        set({ sessions: ops.touchSession(get().sessions, origin, new Date().toISOString()) }),
      updateSessionChain: (origin, chainId) =>
        set({ sessions: ops.updateSessionChain(get().sessions, origin, chainId, new Date().toISOString()) }),
      findSession: (origin) => ops.findSession(get().sessions, origin),
    }),
```

Leave the `DAppSession` type, the `DAppSessionsState` type, and the `persist` config (`name: "trezo_dapp_sessions_v1"`, AsyncStorage) unchanged.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

```bash
git add apps/mobile/src/features/browser/store/sessionOps.ts \
        apps/mobile/src/features/browser/store/useDAppSessionsStore.ts \
        apps/mobile/src/features/browser/store/__tests__/sessionOps.test.ts
git commit -m "refactor(browser): extract pure session reducers + unit tests"
```

---

## Task 4: `getHostname` URL helper + test

**Files:**
- Create: `apps/mobile/src/features/browser/utils/url.ts`
- Test: `apps/mobile/src/features/browser/utils/__tests__/url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/browser/utils/__tests__/url.test.ts`:

```ts
import { getHostname } from "../url";

function assertEqual(a: unknown, b: unknown, msg: string): void {
  if (a !== b) throw new Error(`assertEqual failed: ${msg}\n  expected: ${String(b)}\n  actual:   ${String(a)}`);
}

function run(): void {
  assertEqual(getHostname("https://app.uniswap.org/swap?x=1"), "app.uniswap.org", "path/query stripped");
  assertEqual(getHostname("https://www.coingecko.com"), "coingecko.com", "www. stripped");
  assertEqual(getHostname("http://example.com:8080/a"), "example.com", "port stripped");
  assertEqual(getHostname("not a url"), "not a url", "non-URL returned as-is");
  assertEqual(getHostname(""), "", "empty returned as-is");
  console.log("OK url");
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/features/browser/utils/__tests__/url.test.ts`
Expected: FAIL — `Cannot find module '../url'`.

- [ ] **Step 3: Create the helper**

Create `apps/mobile/src/features/browser/utils/url.ts`:

```ts
// Extracts a clean display hostname from a URL (strips scheme, www., port, path).
// Returns the raw input unchanged when it is not a parseable URL.
// `URL` is global in Node and polyfilled in the app via react-native-url-polyfill.
export function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/features/browser/utils/__tests__/url.test.ts`
Expected: PASS — prints `OK url`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/browser/utils/url.ts \
        apps/mobile/src/features/browser/utils/__tests__/url.test.ts
git commit -m "feat(browser): add getHostname url helper + tests"
```

---

## Task 5: `BrowserTopBar` component

Presentational, props-driven. No unit test (UI under RN is not `tsx`-runnable without a renderer); it is verified during the Task 7 integration + manual checklist. It depends only on `getHostname` (Task 4) and the theme.

**Files:**
- Create: `apps/mobile/src/features/browser/components/BrowserTopBar.tsx`

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/features/browser/components/BrowserTopBar.tsx`:

```tsx
import React from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ThemeColors } from "@theme";
import { getHostname } from "../utils/url";

export type BrowserTopBarProps = {
  url: string;
  text: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  editing: boolean;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  canGoBack: boolean;
  onBack: () => void;
  tabCount: number;
  onOpenTabs: () => void;
  onOpenMenu: () => void;
  colors: ThemeColors;
};

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

export function BrowserTopBar({
  url,
  text,
  onChangeText,
  onSubmit,
  editing,
  onBeginEdit,
  onEndEdit,
  canGoBack,
  onBack,
  tabCount,
  onOpenTabs,
  onOpenMenu,
  colors,
}: BrowserTopBarProps) {
  const isSecure = /^https:\/\//i.test(url);
  const hostname = getHostname(url);

  return (
    <View style={styles.bar}>
      {editing ? (
        <View style={[styles.editWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}>
          <Feather name="search" size={15} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            onBlur={onEndEdit}
            autoFocus
            selectTextOnFocus
            placeholder="Search or enter address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "url", default: "default" })}
            returnKeyType="go"
            style={[styles.input, { color: colors.textPrimary }]}
          />
          {text.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText("")} hitSlop={HIT}>
              <Feather name="x" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {canGoBack && (
            <TouchableOpacity onPress={onBack} hitSlop={HIT} style={styles.iconBtn}>
              <Feather name="chevron-left" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.domainPill, { backgroundColor: colors.surfaceElevated }]}
            onPress={onBeginEdit}
            activeOpacity={0.7}
          >
            <Feather name={isSecure ? "lock" : "globe"} size={12} color={isSecure ? colors.success : colors.textMuted} />
            <Text style={[styles.domain, { color: colors.textPrimary }]} numberOfLines={1}>
              {hostname || "Search or enter address"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, { borderColor: colors.border }]}
            onPress={onOpenTabs}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabCount, { color: colors.textPrimary }]}>{tabCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenMenu} hitSlop={HIT} style={styles.iconBtn}>
            <Feather name="more-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  domainPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 9, default: 7 }),
  },
  domain: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  tabBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCount: { fontSize: 12, fontWeight: "700" },
  editWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 9, default: 6 }),
  },
  input: { flex: 1, fontSize: 14, fontWeight: "500" },
});
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

```bash
git add apps/mobile/src/features/browser/components/BrowserTopBar.tsx
git commit -m "feat(browser): add slim BrowserTopBar (back/domain/tabs/menu)"
```

---

## Task 6: `BrowserMenuSheet` component

The `⋯` bottom sheet. Uses `TrezoBottomSheet` (the same wrapper the dApp approval sheets use), exposing an imperative `present()` handle. No unit test (UI) — verified in Task 7 + manual checklist.

**Files:**
- Create: `apps/mobile/src/features/browser/components/BrowserMenuSheet.tsx`

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/features/browser/components/BrowserMenuSheet.tsx`:

```tsx
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { TrezoBottomSheet } from "@shared/components/sheets";
import type { ThemeColors } from "@theme";

export type BrowserMenuHandle = { present: () => void; dismiss: () => void };

export type BrowserMenuSheetProps = {
  title: string;
  hostname: string;
  connected: boolean;
  canGoForward: boolean;
  onReload: () => void;
  onForward: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onNewTab: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
  colors: ThemeColors;
};

export const BrowserMenuSheet = forwardRef<BrowserMenuHandle, BrowserMenuSheetProps>(
  (
    {
      title,
      hostname,
      connected,
      canGoForward,
      onReload,
      onForward,
      onCopyLink,
      onShare,
      onNewTab,
      onDisconnect,
      onOpenSettings,
      colors,
    },
    ref,
  ) => {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const run = (fn: () => void) => () => {
      sheetRef.current?.dismiss();
      fn();
    };

    return (
      <TrezoBottomSheet ref={sheetRef} enableDynamicSizing>
        <View style={styles.body}>
          <View style={[styles.header, { borderBottomColor: colors.borderMuted }]}>
            <View style={[styles.favicon, { backgroundColor: colors.surfaceElevated }]}>
              <Feather name="globe" size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title || hostname || "New Tab"}
              </Text>
              <Text
                style={[styles.status, { color: connected ? colors.success : colors.textMuted }]}
                numberOfLines={1}
              >
                {connected ? `Connected · ${hostname}` : "Not connected"}
              </Text>
            </View>
          </View>

          <MenuRow icon="rotate-cw" label="Reload" color={colors.textPrimary} onPress={run(onReload)} />
          <MenuRow
            icon="chevron-right"
            label="Forward"
            color={colors.textPrimary}
            disabled={!canGoForward}
            onPress={run(onForward)}
          />
          <MenuRow icon="link" label="Copy link" color={colors.textPrimary} onPress={run(onCopyLink)} />
          <MenuRow icon="share" label="Share" color={colors.textPrimary} onPress={run(onShare)} />
          <MenuRow icon="plus" label="New tab" color={colors.textPrimary} onPress={run(onNewTab)} />
          {connected && (
            <MenuRow icon="power" label="Disconnect dApp" color={colors.danger} onPress={run(onDisconnect)} />
          )}
          <MenuRow icon="settings" label="Browser settings" color={colors.textSecondary} onPress={run(onOpenSettings)} />
        </View>
      </TrezoBottomSheet>
    );
  },
);

BrowserMenuSheet.displayName = "BrowserMenuSheet";

function MenuRow({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  favicon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  status: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 4 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
});
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

```bash
git add apps/mobile/src/features/browser/components/BrowserMenuSheet.tsx
git commit -m "feat(browser): add BrowserMenuSheet with connection status + disconnect"
```

---

## Task 7: Rebuild `BrowserScreen` — full-bleed, themed, wired

This integrates everything: replaces the header (tab strip + URL bar) with `BrowserTopBar`, makes the page full-bleed, themes the WebView background, hints `prefers-color-scheme`, and wires `BrowserMenuSheet`. The RPC context already carries the injected fields from Task 2.

**Files:**
- Modify: `apps/mobile/src/features/browser/screens/BrowserScreen.tsx`

- [ ] **Step 1: Replace the file**

Replace the **entire** contents of `apps/mobile/src/features/browser/screens/BrowserScreen.tsx` with:

```tsx
import { useTabContentBottomInset } from "@hooks";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import { toDestination, useBrowserStore, type BrowserTab } from "@store/useBrowserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import { hashMessage, hashTypedData, type Hex } from "viem";
import { DiscoverHome } from "../components/discover/DiscoverHome";
import { BrowserTopBar } from "../components/BrowserTopBar";
import { BrowserMenuSheet, type BrowserMenuHandle } from "../components/BrowserMenuSheet";
import { getHostname } from "../utils/url";
import { INJECTED_PROVIDER_SCRIPT } from "@features/browser/web/injectedProvider.template";
import { handleRPC } from "@features/browser/web/rpcRouter";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import { ApproveConnectionSheet, type ApproveHandle } from "@features/browser/components/dapp/ApproveConnectionSheet";
import { SignMessageSheet, type SignMessageHandle } from "@features/browser/components/dapp/SignMessageSheet";
import { SignTypedDataSheet, type SignTypedDataHandle } from "@features/browser/components/dapp/SignTypedDataSheet";
import { SendTransactionSheet, type SendTransactionHandle } from "@features/browser/components/dapp/SendTransactionSheet";
import { SwitchChainSheet, type SwitchChainHandle } from "@features/browser/components/dapp/SwitchChainSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import PasskeyService from "@features/wallet/services/PasskeyService";
import { SmartAccountExecutionService } from "@features/wallet/services/SmartAccountExecutionService";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { DEFAULT_CHAIN_ID, getChainConfig, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";

// Best-effort prefers-color-scheme hint so theme-aware sites follow the app theme.
// The guaranteed win is the themed container/WebView background (kills the white flash);
// this is layered on top. Injected before content loads and re-injected on theme toggle.
function buildColorSchemeScript(mode: "light" | "dark"): string {
  return `
(function () {
  try {
    var scheme = ${JSON.stringify(mode)};
    document.documentElement.style.colorScheme = scheme;
    var m = document.querySelector('meta[name="color-scheme"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "color-scheme");
      if (document.head) document.head.appendChild(m);
    }
    m.setAttribute("content", scheme === "dark" ? "dark light" : "light dark");
  } catch (e) {}
})();
true;
`;
}

export default function BrowserScreen() {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useTabContentBottomInset(-28);
  const navigation = useNavigation<any>();

  // EIP-1193 approval sheet refs
  const approveRef = useRef<ApproveHandle>(null);
  const signMessageRef = useRef<SignMessageHandle>(null);
  const signTypedDataRef = useRef<SignTypedDataHandle>(null);
  const sendTxRef = useRef<SendTransactionHandle>(null);
  const switchChainRef = useRef<SwitchChainHandle>(null);
  const menuRef = useRef<BrowserMenuHandle>(null);

  // Source the smart-account address for dApp sessions
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);
  const user = useUserStore((s) => s.user);
  const accountAddress = (aaAccount?.predictedAddress ?? smartAccountAddress ?? null) as `0x${string}` | null;
  const accountState = useAccountState();
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();

  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const settings = useBrowserStore((state) => state.settings);
  const addTab = useBrowserStore((state) => state.addTab);
  const removeTab = useBrowserStore((state) => state.removeTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const addToHistory = useBrowserStore((state) => state.addToHistory);
  const sessions = useDAppSessionsStore((state) => state.sessions);

  const webRefs = useRef<Map<string, WebView>>(new Map());
  const [text, setText] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showHome, setShowHome] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const colorSchemeScript = useMemo(() => buildColorSchemeScript(resolvedMode), [resolvedMode]);

  const activeOrigin = useMemo(() => {
    if (!activeTab?.url) return "";
    try {
      return new URL(activeTab.url).origin;
    } catch {
      return activeTab.url;
    }
  }, [activeTab?.url]);

  const connected = useMemo(
    () => sessions.some((s) => s.origin === activeOrigin),
    [sessions, activeOrigin],
  );

  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
      setShowHome(true);
    }
  }, [tabs.length, addTab]);

  useEffect(() => {
    if (activeTab) setText(activeTab.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, activeTab?.url]);

  // Re-inject the color-scheme hint into all live WebViews when the app theme toggles.
  useEffect(() => {
    webRefs.current.forEach((wv) => {
      try {
        wv.injectJavaScript(colorSchemeScript);
      } catch {
        // webview not ready / detached — ignore
      }
    });
  }, [colorSchemeScript]);

  const onSubmit = useCallback(() => {
    if (!text.trim() || !activeTabId) return;
    const dest = toDestination(text, settings.searchEngine);
    updateTab(activeTabId, { url: dest, title: dest });
    setText(dest);
    setShowHome(false);
    setEditing(false);
  }, [text, activeTabId, settings.searchEngine, updateTab]);

  const goBack = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (webView && canGoBack) webView.goBack();
  }, [activeTabId, canGoBack]);

  const goForward = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (webView && canGoForward) webView.goForward();
  }, [activeTabId, canGoForward]);

  const reload = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (!webView) return;
    if (loading) webView.stopLoading();
    else webView.reload();
  }, [activeTabId, loading]);

  const handleNewTab = useCallback(() => {
    const newTabId = addTab();
    if (newTabId) setShowHome(true);
  }, [addTab]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      removeTab(tabId);
      webRefs.current.delete(tabId);
      if (tabs.length <= 1) setShowHome(true);
    },
    [removeTab, tabs.length],
  );

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setShowTabSwitcher(false);
      setShowHome(false);
    },
    [setActiveTab],
  );

  // Shared helper: load a URL in the active (or new) tab and exit home.
  const openUrl = useCallback(
    (url: string) => {
      if (!activeTabId) {
        const newTabId = addTab(url);
        if (newTabId) setShowHome(false);
      } else {
        updateTab(activeTabId, { url, title: url });
        setShowHome(false);
      }
    },
    [activeTabId, addTab, updateTab],
  );

  const beginEdit = useCallback(() => {
    setEditing(true);
    if (activeTab) setText(activeTab.url);
  }, [activeTab]);

  const handleCopyLink = useCallback(() => {
    if (activeTab?.url) Clipboard.setStringAsync(activeTab.url);
  }, [activeTab?.url]);

  const handleShare = useCallback(() => {
    if (activeTab?.url) Share.share({ message: activeTab.url }).catch(() => {});
  }, [activeTab?.url]);

  const handleDisconnect = useCallback(() => {
    if (activeOrigin) useDAppSessionsStore.getState().removeSession(activeOrigin);
  }, [activeOrigin]);

  const handleOpenSettings = useCallback(() => {
    navigation.navigate("BrowserSettings");
  }, [navigation]);

  return (
    <TabScreenContainer style={styles.safeArea}>
      {/* ── Slim top bar (browsing only; home uses DiscoverHome's own search) ── */}
      {!showHome && (
        <BrowserTopBar
          url={activeTab?.url ?? ""}
          text={text}
          onChangeText={setText}
          onSubmit={onSubmit}
          editing={editing}
          onBeginEdit={beginEdit}
          onEndEdit={() => setEditing(false)}
          canGoBack={canGoBack}
          onBack={goBack}
          tabCount={tabs.length}
          onOpenTabs={() => setShowTabSwitcher(true)}
          onOpenMenu={() => menuRef.current?.present()}
          colors={colors}
        />
      )}

      {/* Progress */}
      {loading && !showHome && (
        <View style={[styles.progressTrack, { backgroundColor: colors.borderMuted }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      )}

      {/* ── Content (full-bleed, themed background) ─────────────── */}
      <View style={[styles.webShell, { backgroundColor: colors.background, marginBottom: bottomInset }]}>
        {showHome ? (
          <DiscoverHome
            onSubmitSearch={(intent) => {
              if (intent.kind === "url") {
                openUrl(intent.value);
              } else if (intent.kind === "ticker") {
                openUrl(`https://www.coingecko.com/en/search?query=${encodeURIComponent(intent.value)}`);
              } else {
                openUrl(`https://www.google.com/search?q=${encodeURIComponent(intent.value)}`);
              }
            }}
            onOpenTabs={() => setShowTabSwitcher(true)}
            onTokenPress={(id) => openUrl(`https://www.coingecko.com/en/coins/${id}`)}
            onSitePress={openUrl}
          />
        ) : (
          tabs.map((tab) => (
            <View
              key={tab.id}
              style={[
                styles.webViewContainer,
                { backgroundColor: colors.background, display: tab.id === activeTabId ? "flex" : "none" },
              ]}
            >
              <WebView
                ref={(ref) => {
                  if (ref) webRefs.current.set(tab.id, ref);
                }}
                source={{ uri: tab.url }}
                injectedJavaScriptBeforeContentLoaded={INJECTED_PROVIDER_SCRIPT + colorSchemeScript}
                onMessage={(event) => {
                  if (tab.id !== activeTabId) return;
                  let msg: { type?: string; id?: string; method?: string; params?: unknown[] };
                  try {
                    msg = JSON.parse(event.nativeEvent.data);
                  } catch {
                    return;
                  }
                  if (msg?.type !== "rpc" || !msg.id || !msg.method) return;

                  let origin: string;
                  try {
                    origin = new URL(tab.url).origin;
                  } catch {
                    origin = tab.url;
                  }

                  const webview = webRefs.current.get(tab.id) ?? null;

                  handleRPC(
                    {
                      webview,
                      origin,
                      defaultChainId: DEFAULT_CHAIN_ID,
                      findSession: (o) => useDAppSessionsStore.getState().findSession(o),
                      touchSession: (o) => useDAppSessionsStore.getState().touchSession(o),
                      requestApproval: async (o, chainId) => {
                        const ok = await approveRef.current?.ask(o);
                        if (!ok) return null;
                        if (!accountAddress) return null;
                        return useDAppSessionsStore
                          .getState()
                          .addSession({ origin: o, accountAddress, chainId });
                      },
                      requestSignMessage: async (o, hex) => {
                        const ok = await signMessageRef.current?.ask(o, hex);
                        if (!ok || !user?.id) return null;
                        // EIP-1271 path: contracts already accept the same WebAuthn encoding for
                        // both validateUserOp and isValidSignatureWithSender (see PasskeyValidator.sol).
                        const messageHash = hashMessage({ raw: hex as Hex });
                        const sig = await PasskeyService.signWithPasskey(user.id, messageHash);
                        return PasskeyService.encodeSignatureForContract(sig) as Hex;
                      },
                      requestSignTypedData: async (o, td) => {
                        const ok = await signTypedDataRef.current?.ask(o, td);
                        if (!ok || !user?.id) return null;
                        const typed = td as {
                          domain: Record<string, unknown>;
                          types: Record<string, Array<{ name: string; type: string }>>;
                          primaryType: string;
                          message: Record<string, unknown>;
                        };
                        const typedHash = hashTypedData({
                          domain: typed.domain,
                          types: typed.types,
                          primaryType: typed.primaryType,
                          message: typed.message,
                        } as Parameters<typeof hashTypedData>[0]);
                        const sig = await PasskeyService.signWithPasskey(user.id, typedHash);
                        return PasskeyService.encodeSignatureForContract(sig) as Hex;
                      },
                      requestSendTransaction: async (o, tx) => {
                        const ok = await sendTxRef.current?.ask(o, tx);
                        if (!ok || !user?.id || !accountAddress) return null;
                        const session = useDAppSessionsStore.getState().findSession(o);
                        if (!session) return null;

                        // Brief Rule (§3.3): "If the user's account is not yet Active on the
                        // request's chain, prompt activation first." Gate via ActivationSheet.
                        const chainId = session.chainId;
                        if (!SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId)) return null;
                        const typedChainId = chainId as SupportedChainId;
                        const isActive = accountState.isActiveOnChain(chainId);
                        const activated = await new Promise<boolean>((resolve) => {
                          requireActiveOnChain(
                            chainId,
                            isActive,
                            () => resolve(true),
                            () => resolve(false),
                          );
                        });
                        if (!activated) return null;

                        // Wrap the dApp tx into a smart-account execute UserOp, sign, submit.
                        // Per ADR-0001: testnets sponsor all UserOps.
                        const chain = getChainConfig(typedChainId);
                        const prepared = await SmartAccountExecutionService.prepareUserOperation(
                          {
                            chainId: typedChainId,
                            account: accountAddress,
                            target: tx.to,
                            value: tx.value ? BigInt(tx.value) : 0n,
                            data: (tx.data ?? "0x") as Hex,
                            operationLabel: "dapp:eth_sendTransaction",
                            riskLevel: "medium",
                          },
                          {
                            userId: user.id,
                            usePaymaster: Boolean(chain?.paymasterUrl),
                            paymasterUrl: chain?.paymasterUrl,
                          },
                        );
                        const signed = await SmartAccountExecutionService.signUserOperation(
                          user.id,
                          prepared,
                        );
                        const submitted = await SmartAccountExecutionService.submitUserOperation(signed);
                        // Per ADR-0002: we return the userOpHash (not a tx hash). Modern
                        // ERC-4337-aware dApps treat the return as opaque and poll the bundler
                        // for the receipt, which exposes the on-chain tx hash.
                        return submitted.submittedUserOpHash as Hex;
                      },
                      requestSwitchChain: async (o, chainId) => {
                        const ok = await switchChainRef.current?.ask(o, chainId);
                        if (!ok) return false;
                        useDAppSessionsStore.getState().updateSessionChain(o, chainId);
                        return true;
                      },
                    },
                    {
                      type: "rpc",
                      id: msg.id,
                      method: msg.method,
                      params: msg.params ?? [],
                    },
                  );
                }}
                onNavigationStateChange={(nav) => {
                  if (tab.id === activeTabId) {
                    setCanGoBack(nav.canGoBack);
                    setCanGoForward(nav.canGoForward);
                    if (nav.url && nav.url !== tab.url) {
                      updateTab(tab.id, { url: nav.url, title: nav.title || nav.url });
                      addToHistory(nav.url, nav.title || nav.url);
                    }
                  }
                }}
                onLoadStart={() => tab.id === activeTabId && setLoading(true)}
                onLoadEnd={() => tab.id === activeTabId && setLoading(false)}
                onLoadProgress={(e) => tab.id === activeTabId && setProgress(e.nativeEvent.progress)}
                onShouldStartLoadWithRequest={(req) => {
                  const u = req?.url ?? "";
                  if (!u) return false;
                  if (/^(javascript|data|file|intent):/i.test(u)) return false;
                  return true;
                }}
                applicationNameForUserAgent="TrezoBrowser/1.0"
                startInLoadingState
                style={[styles.webView, { backgroundColor: colors.background }]}
              />
            </View>
          ))
        )}
      </View>

      <TabSwitcherModal
        visible={showTabSwitcher}
        tabs={tabs}
        activeTabId={activeTabId}
        onClose={() => setShowTabSwitcher(false)}
        onSelectTab={handleSwitchTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        colors={colors}
      />

      {/* ⋯ menu */}
      <BrowserMenuSheet
        ref={menuRef}
        title={activeTab?.title ?? ""}
        hostname={getHostname(activeTab?.url ?? "")}
        connected={connected}
        canGoForward={canGoForward}
        onReload={reload}
        onForward={goForward}
        onCopyLink={handleCopyLink}
        onShare={handleShare}
        onNewTab={handleNewTab}
        onDisconnect={handleDisconnect}
        onOpenSettings={handleOpenSettings}
        colors={colors}
      />

      {/* EIP-1193 dApp approval sheets */}
      <ApproveConnectionSheet ref={approveRef} />
      <SignMessageSheet ref={signMessageRef} />
      <SignTypedDataSheet ref={signTypedDataRef} />
      <SendTransactionSheet ref={sendTxRef} />
      <SwitchChainSheet ref={switchChainRef} />

      {/* Activation gate for eth_sendTransaction when not Active on session chain */}
      <ActivationSheet ref={activationSheetRef} />
    </TabScreenContainer>
  );
}

// ── Tab Switcher Modal ────────────────────────────────────────────────────────

function TabSwitcherModal({
  visible,
  tabs,
  activeTabId,
  onClose,
  onSelectTab,
  onCloseTab,
  onNewTab,
  colors,
}: {
  visible: boolean;
  tabs: BrowserTab[];
  activeTabId: string | null;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  colors: ThemeColors;
}) {
  const s = useMemo(() => createModalStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { borderBottomColor: colors.borderMuted }]}>
          <View>
            <Text style={[s.title, { color: colors.textPrimary }]}>Open Tabs</Text>
            <Text style={[s.subtitle, { color: colors.textMuted }]}>
              {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.grid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                s.tabCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: tab.id === activeTabId ? colors.accent : colors.border,
                  borderWidth: tab.id === activeTabId ? 2 : 1,
                },
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.8}
            >
              <View style={[s.tabPreview, { backgroundColor: colors.surfaceCard }]}>
                <Feather name="globe" size={28} color={`${colors.accent}40`} />
              </View>
              <View style={s.tabMeta}>
                <Text style={[s.tabTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {tab.title}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[s.tabUrl, { color: colors.textMuted }]} numberOfLines={1}>
                {tab.url}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[s.newTabCard, { backgroundColor: `${colors.accent}0D`, borderColor: `${colors.accent}26` }]}
            onPress={() => {
              onNewTab();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={[s.newTabIcon, { backgroundColor: colors.accent }]}>
              <Feather name="plus" size={22} color={colors.textOnAccent} />
            </View>
            <Text style={[s.newTabText, { color: colors.textPrimary }]}>New Tab</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    progressTrack: {
      height: 2,
      width: "100%",
      borderRadius: 1,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 1 },
    webShell: { flex: 1 },
    webViewContainer: { flex: 1 },
    webView: { flex: 1 },
  });
}

function createModalStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    subtitle: { fontSize: 13, fontWeight: "500", marginTop: 2 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    grid: { padding: 20, gap: 14 },
    tabCard: {
      borderRadius: 18,
      overflow: "hidden",
    },
    tabPreview: {
      height: 90,
      alignItems: "center",
      justifyContent: "center",
    },
    tabMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
    },
    tabTitle: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
    tabUrl: {
      fontSize: 11,
      fontWeight: "500",
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    newTabCard: {
      height: 130,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    newTabIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    newTabText: { fontSize: 15, fontWeight: "700" },
  });
}
```

> Notes: `TabPill` and `NavBtn` are deleted (the tab strip and inline nav buttons are gone). `isUrl` / `Platform` / `TextInput` imports are dropped from this file (they now live in `BrowserTopBar`). `createStyles`/`createModalStyles` keep a `_colors` param for signature stability even though the static styles no longer read it.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors in the browser feature.

- [ ] **Step 3: Manual verification (Expo dev build on a device/emulator, default network Base Sepolia)**

Start the app (`npm run android` or `npm run ios` from `apps/mobile`), then verify:

1. **Detection:** Open the in-app browser → navigate to `app.uniswap.org` → tap **Connect**. "Trezo" (with the violet "T" icon) appears in the wallet list (under "Other wallets" / "Installed", labeled detected). Tapping it opens `ApproveConnectionSheet`; approving returns the smart-account address and the site shows connected.
2. **Full-bleed:** The page renders edge-to-edge between the slim top bar and the bottom tab bar — no rounded card, no side margins, no tab-pill strip.
3. **Top bar:** Back ‹ only shows when there's history; the centered pill shows the lock + hostname; tapping it switches to an editable URL field with a clear (✕); the tab-count button opens the tab switcher; ⋯ opens the menu.
4. **Menu:** Shows connection status (`Connected · <host>` when connected, else `Not connected`); Reload/Forward/Copy link/Share/New tab work; **Disconnect dApp** appears only when connected and clears the session; **Browser settings** navigates to the settings screen.
5. **Theme:** With the app in **dark** mode, there's no white load flash (WebView background is the app background); theme-aware sites render dark. Switch the app to **light** → sites render light (a white site in a light app is correct). Toggle theme while a page is open → the color-scheme hint re-injects.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/browser/screens/BrowserScreen.tsx
git commit -m "feat(browser): full-bleed themed chrome with BrowserTopBar + menu"
```

---

## Task 8: Test script + final verification

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add a convenience test script**

In `apps/mobile/package.json`, add to `"scripts"` (after `"lint"`):

```json
    "lint": "expo lint",
    "test:dapp": "tsx src/features/browser/web/__tests__/injectedProvider.template.test.ts && tsx src/features/browser/web/__tests__/rpcRouter.test.ts && tsx src/features/browser/store/__tests__/sessionOps.test.ts && tsx src/features/browser/utils/__tests__/url.test.ts"
```

(Keep the trailing comma correct: `"lint"` now needs a trailing comma before `"test:dapp"`.)

- [ ] **Step 2: Run the whole dApp test suite**

Run (from `apps/mobile/`): `npm run test:dapp`
Expected: prints `OK injectedProvider.template`, `OK rpcRouter`, `OK sessionOps`, `OK url` and exits 0.

- [ ] **Step 3: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json
git commit -m "chore(browser): add test:dapp script for the dApp-connect unit tests"
```

---

## Self-Review (spec coverage)

- **Spec Part A (EIP-6963 detection):** Task 1 — `announce()` + `eip6963:requestProvider` listener, `info { uuid, name, rdns, icon }`, early-bail removed, icon as data-URI constant. ✓
- **Spec Part B (chrome rebuild):** Task 5 (`BrowserTopBar`: back/domain/tab-count/⋯), Task 6 (`BrowserMenuSheet`: reload/forward/copy/share/new-tab/connection status + disconnect/settings), Task 7 (full-bleed, removes tab-strip + URL bar). ✓
- **Spec Theme handling:** Task 7 — WebView + container `backgroundColor = colors.background` (guaranteed, no flash) + best-effort `prefers-color-scheme` via injected script following `resolvedMode`, re-injected on toggle; no force-darkening. ✓
- **Spec Tests:** `rpcRouter` (Task 2), session reducers (Task 3, via the extracted `sessionOps` — the testable seam, since the store itself pulls AsyncStorage), EIP-6963 announce/info (Task 1). ✓ — **Deviation from spec, intentional:** the spec assumed jest-expo; the repo has no jest, so tests follow the existing `tsx` script convention. AsyncStorage persistence is not unit-tested under `tsx` (framework behavior); the persist key is left unchanged and verified at runtime.
- **Spec "Files touched":** `injectedProvider.template.ts` ✓, icon constant ✓ (named `trezoProviderIcon.ts` per spec), `BrowserScreen.tsx` ✓, `BrowserTopBar.tsx` ✓, `BrowserMenuSheet.tsx` ✓, tests ✓. Added (not in spec, needed for testability): `rpcRouter.ts` DI refactor, `sessionOps.ts`, `utils/url.ts`, `package.json` script.
- **Type consistency:** `RPCContext` fields (`defaultChainId`/`findSession`/`touchSession`) defined in Task 2 are supplied identically in Task 2 Step 5 and Task 7. `BrowserMenuHandle.present` defined in Task 6 and called via `menuRef.current?.present()` in Task 7. `getHostname` signature consistent across Tasks 4/5/7. `upsertSession` return shape `{ sessions, session }` consistent between Task 3 reducer, test, and store.
- **Icon deviation:** spec said "generated from `icon_nobackground.png`"; the plan uses a tiny inline brand SVG data-URI instead — strictly smaller (≈291 chars), crisper, and needs no image-build step (directly serves the spec's "keep the data-URI small" risk note).
- **Placeholder scan:** none — every code step contains complete content.
```