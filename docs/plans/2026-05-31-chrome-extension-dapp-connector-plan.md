# Trezo Chrome Extension (MV3) — dApp Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an MV3 Chrome extension that pairs as a new device on the user's existing Trezo smart account and lets real dApps connect, sign (Windows Hello), and send a gasless transaction on Base Sepolia.

**Architecture:** Four contexts — `inpage` (EIP-1193/6963 provider), `content` (relay), `background` (service worker hosting the RPC router + AA core + Supabase + Pimlico HTTP), and a React `popup` that runs every WebAuthn ceremony (service workers can't call `navigator.credentials`). The AA/passkey/pairing logic is copied-and-adapted from `apps/mobile` into `apps/extension/src/core`.

**Tech Stack:** Vite 8, React 19, `@crxjs/vite-plugin`, viem 2, `@supabase/supabase-js`, Tailwind 3, vitest (unit tests for pure logic). Companion spec: `docs/plans/2026-05-31-chrome-extension-dapp-connector-design.md`.

---

## Conventions for the executor

- **Working dir:** the worktree root `D:\trezo\.claude\worktrees\chrome-extension`. All paths below are relative to it.
- **Do NOT run `npm install` inside the worktree** — deps resolve up to the repo-root `node_modules`. New deps are added with `npm install -w apps/extension <pkg>` run **from the repo root** `D:\trezo` only when a task says so. If a dep is already in root `node_modules`, prefer referencing it without reinstalling.
- **Shell:** PowerShell on Windows. Use `;` not `&&` to chain. Commands below show the portable form; adapt chaining if needed.
- **Commits:** never add a `Co-Authored-By: Claude` trailer (repo rule). Commit after every passing step.
- **Tests:** pure logic → `vitest` (fast, Node env). Browser-only behaviour (injection, WebAuthn, content script) → **manual Chrome verification** steps, using the **DevTools → WebAuthn** virtual authenticator to simulate passkeys without hardware. Each manual step lists exactly what to click and what to observe.
- **Reuse-by-copy:** when a task says "copy `<src>` to `<dest>`", copy the file verbatim, then apply only the listed edits. Do not rewrite the copied logic.
- **Chrome:** use Chrome ≥ 122 (required for extension WebAuthn custom RP ID). Verify with `chrome://version`.

---

## File structure (created in this plan)

```
apps/extension/
  package.json                 # workspace member, scripts, deps
  tsconfig.json                # TS config (DOM + chrome types)
  vite.config.ts               # @crxjs/vite-plugin + react
  vitest.config.ts             # unit test config
  manifest.config.ts           # MV3 manifest (typed, consumed by crxjs)
  .env.local                   # VITE_* config (gitignored)
  index.html                   # popup entry
  src/
    types/messages.ts          # cross-context message contracts
    inpage.ts                  # EIP-1193 + EIP-6963 provider (from injectedProvider.template.ts)
    content.ts                 # page <-> background relay
    background.ts              # service worker: wiring, session store, popup bridge
    rpc/rpcRouter.ts           # ported router; approvals bridged to popup
    rpc/sessionStore.ts        # per-origin sessions in chrome.storage
    core/
      config.ts                # Base Sepolia config from VITE_* env
      chains.ts                # minimal chain def
      deployments.json         # copied Base Sepolia deployment addresses
      abis.ts                  # copied ABIs (smartAccount, accountFactory, passkeyValidator, entryPoint)
      clients.ts               # browser viem public client
      userOps.ts               # copied UserOp builder/submit
      revertDecoding.ts        # copied
      smartAccountExecution.ts # thin wrapper: prepare/sign/submit/wait
    passkey/
      encode.ts                # copied encode logic + ArrayBuffer->base64url adapter
      webauthnService.ts       # navigator.credentials create/get + chrome.storage metadata
    pairing/
      devicePairingService.ts  # chrome.storage + Web Crypto port of DevicePairingService
    auth/
      supabaseClient.ts        # @supabase/supabase-js client
      authService.ts           # email + Google OAuth, session
    popup/
      main.tsx                 # React root
      App.tsx                  # router between screens
      screens/LoginScreen.tsx
      screens/PairDeviceScreen.tsx
      screens/HomeScreen.tsx
      sheets/ConnectSheet.tsx
      sheets/SignSheet.tsx
      sheets/TxConfirmSheet.tsx
      lib/approvalBridge.ts    # popup <-> background approval protocol
  README.md                    # build/load/demo instructions
```

---

## Milestone 0 — Scaffold a loadable MV3 extension

Outcome: an empty-but-loadable extension whose popup says "Trezo" and whose service worker logs a heartbeat.

### Task 0.1: Create the workspace package

**Files:**
- Create: `apps/extension/package.json`

- [ ] **Step 1: Write `apps/extension/package.json`**

```json
{
  "name": "@trezo/extension",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.105.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "viem": "^2.48.4"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@types/chrome": "^0.0.300",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "autoprefixer": "^10.5.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.19",
    "typescript": "~5.7.0",
    "vite": "^8.0.10",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Register the workspace**

Edit repo-root `package.json` `workspaces` array (Modify: `package.json`) to add `"apps/extension"`:

```json
  "workspaces": [
    "apps/mobile",
    "apps/guardian-approval",
    "apps/extension",
    "apps/backend/indexer",
    "apps/backend/zk-email-recovery-api",
    "contracts"
  ],
```

- [ ] **Step 3: Install deps (from repo root only)**

Run from `D:\trezo`:
```
npm install -w apps/extension
```
Expected: adds `@crxjs/vite-plugin`, `vitest`, `@types/chrome` etc. to root `node_modules`. If it errors on peer deps, re-run with `--legacy-peer-deps`.

- [ ] **Step 4: Commit**

```
git add apps/extension/package.json package.json package-lock.json
git commit -m "chore(extension): scaffold workspace package"
```

### Task 0.2: TypeScript + Vite + Tailwind config

**Files:**
- Create: `apps/extension/tsconfig.json`, `apps/extension/vite.config.ts`, `apps/extension/vitest.config.ts`, `apps/extension/postcss.config.js`, `apps/extension/tailwind.config.js`, `apps/extension/src/popup/index.css`

- [ ] **Step 1: `apps/extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "types": ["chrome", "vite/client"]
  },
  "include": ["src", "manifest.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 2: `apps/extension/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: { port: 5180, strictPort: true, hmr: { port: 5180 } },
  build: { target: "esnext" },
});
```

- [ ] **Step 3: `apps/extension/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: `apps/extension/postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 5: `apps/extension/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 6: `apps/extension/src/popup/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { width: 360px; min-height: 480px; margin: 0; background: #0b0b0f; color: #f5f5f7; font-family: system-ui, sans-serif; }
```

- [ ] **Step 7: Commit**

```
git add apps/extension/tsconfig.json apps/extension/vite.config.ts apps/extension/vitest.config.ts apps/extension/postcss.config.js apps/extension/tailwind.config.js apps/extension/src/popup/index.css
git commit -m "chore(extension): typescript, vite, tailwind, vitest config"
```

### Task 0.3: MV3 manifest

**Files:**
- Create: `apps/extension/manifest.config.ts`

- [ ] **Step 1: Write the manifest**

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Trezo",
  version: "0.0.1",
  description: "Trezo smart-account wallet for dApps.",
  action: { default_popup: "index.html", default_title: "Trezo" },
  background: { service_worker: "src/background.ts", type: "module" },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content.ts"],
      run_at: "document_start",
      all_frames: false,
    },
  ],
  // host_permissions includes the WebAuthn RP domain (Chrome >=122 lets the
  // extension assert this domain as RP ID) plus dApp origins for RPC.
  host_permissions: ["https://abubakar-tq.github.io/*", "http://*/*", "https://*/*"],
  permissions: ["storage", "tabs"],
  web_accessible_resources: [
    { resources: ["src/inpage.ts"], matches: ["http://*/*", "https://*/*"] },
  ],
});
```

- [ ] **Step 2: Commit**

```
git add apps/extension/manifest.config.ts
git commit -m "feat(extension): MV3 manifest with provider injection + RP host permission"
```

### Task 0.4: Minimal popup + background heartbeat + load in Chrome

**Files:**
- Create: `apps/extension/index.html`, `apps/extension/src/popup/main.tsx`, `apps/extension/src/popup/App.tsx`, `apps/extension/src/background.ts`, `apps/extension/src/content.ts`, `apps/extension/src/inpage.ts`

- [ ] **Step 1: `apps/extension/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Trezo</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: `apps/extension/src/popup/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
```

- [ ] **Step 3: `apps/extension/src/popup/App.tsx`**

```tsx
export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Trezo</h1>
      <p style={{ opacity: 0.7 }}>Smart-account wallet for dApps.</p>
    </div>
  );
}
```

- [ ] **Step 4: `apps/extension/src/background.ts`**

```ts
console.log("[trezo-bg] service worker booted");
chrome.runtime.onInstalled.addListener(() => console.log("[trezo-bg] installed"));
```

- [ ] **Step 5: `apps/extension/src/content.ts` (empty stub for now)**

```ts
// Relay implemented in Milestone 1.
export {};
```

- [ ] **Step 6: `apps/extension/src/inpage.ts` (empty stub for now)**

```ts
// Provider implemented in Milestone 1.
export {};
```

- [ ] **Step 7: Build and load**

Run from `D:\trezo`:
```
npm run -w apps/extension build
```
Expected: a `apps/extension/dist` folder is produced with `manifest.json`.

- [ ] **Step 8: Manual — load unpacked**

1. Open `chrome://extensions`, enable "Developer mode".
2. Click "Load unpacked" → select `apps/extension/dist`.
3. Observe: a "Trezo" extension card with no errors.
4. Click the extension icon → popup shows "Trezo / Smart-account wallet for dApps."
5. Open the card's "service worker" link → console shows `[trezo-bg] service worker booted`.

Expected: all four observations pass. If the SW shows an error, fix before continuing.

- [ ] **Step 9: Commit**

```
git add apps/extension/index.html apps/extension/src
git commit -m "feat(extension): minimal popup + background heartbeat, loads unpacked"
```

---

## Milestone 1 — Inject the provider (satisfies TC-10)

Outcome: a real dApp's wallet list shows **Trezo** (EIP-6963); `eth_chainId`/`eth_accounts` answer from the background.

### Task 1.1: Cross-context message contracts

**Files:**
- Create: `apps/extension/src/types/messages.ts`

- [ ] **Step 1: Write the contracts**

```ts
export type RpcRequestMsg = {
  type: "trezo-rpc";
  id: string;
  method: string;
  params: unknown[];
  origin?: string; // filled by content script
};

export type RpcResponseMsg = {
  type: "trezo-rpc-response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
};

export type ProviderEventMsg = {
  type: "trezo-event";
  event: string;
  data: unknown;
};
```

- [ ] **Step 2: Commit**

```
git add apps/extension/src/types/messages.ts
git commit -m "feat(extension): cross-context message contracts"
```

### Task 1.2: Port the inpage provider (EIP-1193 + EIP-6963)

**Files:**
- Reference source: `apps/mobile/src/features/browser/web/injectedProvider.template.ts`
- Create: `apps/extension/src/inpage.ts`

- [ ] **Step 1: Write `apps/extension/src/inpage.ts`**

Port of the mobile template. Transport swapped from `ReactNativeWebView.postMessage` to `window.postMessage`; responses arrive via `window.postMessage` (not a DOM CustomEvent).

```ts
// Injected into the page MAIN world. EIP-1193 + EIP-6963 provider.
// Transport: window.postMessage to the content script and back.
const TREZO_PROVIDER_NAME = "Trezo";
const TREZO_PROVIDER_RDNS = "com.trezo.wallet";
const TREZO_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNiIgZmlsbD0iIzZkNWVmYSIvPjwvc3ZnPg==";

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pending: Record<string, Pending> = {};

function rid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function uuidv4(): string {
  return (crypto as Crypto).randomUUID();
}

function send(method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = rid();
    pending[id] = { resolve, reject };
    window.postMessage({ type: "trezo-rpc", id, method, params }, "*");
  });
}

const listeners: Record<string, Array<(d: unknown) => void>> = {};

const provider = {
  isTrezo: true,
  isMetaMask: false,
  request(req: { method: string; params?: unknown[] }) {
    return send(req.method, req.params || []);
  },
  on(event: string, cb: (d: unknown) => void) {
    (listeners[event] = listeners[event] || []).push(cb);
  },
  removeListener(event: string, cb: (d: unknown) => void) {
    listeners[event] = (listeners[event] || []).filter((x) => x !== cb);
  },
  enable() {
    return send("eth_requestAccounts", []);
  },
};

try {
  (window as unknown as { ethereum?: unknown }).ethereum = provider;
} catch {
  /* some sites freeze window.ethereum; EIP-6963 still works */
}

const info = { uuid: uuidv4(), name: TREZO_PROVIDER_NAME, rdns: TREZO_PROVIDER_RDNS, icon: TREZO_ICON };
function announce() {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: Object.freeze(info), provider }),
    }),
  );
}
window.addEventListener("eip6963:requestProvider", announce);
announce();

window.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "trezo-rpc-response") {
    const p = pending[msg.id];
    if (!p) return;
    delete pending[msg.id];
    if (msg.error) p.reject(msg.error);
    else p.resolve(msg.result);
  } else if (msg.type === "trezo-event") {
    (listeners[msg.event] || []).forEach((cb) => {
      try { cb(msg.data); } catch { /* ignore */ }
    });
  }
});

window.dispatchEvent(new Event("ethereum#initialized"));
```

- [ ] **Step 2: Commit**

```
git add apps/extension/src/inpage.ts
git commit -m "feat(extension): EIP-1193 + EIP-6963 inpage provider (window.postMessage transport)"
```

### Task 1.3: Content relay (injects inpage into MAIN world)

**Files:**
- Create: `apps/extension/src/content.ts`

- [ ] **Step 1: Write the relay**

```ts
import type { RpcRequestMsg, RpcResponseMsg, ProviderEventMsg } from "./types/messages";

// Inject inpage.ts into the page's MAIN world so it can define window.ethereum.
const url = chrome.runtime.getURL("src/inpage.ts");
const script = document.createElement("script");
script.src = url;
script.type = "module";
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();

// Page -> background
window.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data as RpcRequestMsg;
  if (ev.source !== window || !msg || msg.type !== "trezo-rpc") return;
  chrome.runtime.sendMessage(
    { ...msg, origin: window.location.origin },
    (resp: RpcResponseMsg) => {
      window.postMessage(
        { type: "trezo-rpc-response", id: msg.id, result: resp?.result, error: resp?.error },
        "*",
      );
    },
  );
});

// Background -> page (provider events: accountsChanged, chainChanged)
chrome.runtime.onMessage.addListener((msg: ProviderEventMsg) => {
  if (msg?.type === "trezo-event") window.postMessage(msg, "*");
});
```

- [ ] **Step 2: Commit**

```
git add apps/extension/src/content.ts
git commit -m "feat(extension): content relay injects inpage + bridges RPC to background"
```

### Task 1.4: Background stub router (chainId/accounts only)

**Files:**
- Create: `apps/extension/src/rpc/sessionStore.ts`
- Modify: `apps/extension/src/background.ts`

- [ ] **Step 1: `apps/extension/src/rpc/sessionStore.ts`**

```ts
export type DAppSession = { origin: string; address: `0x${string}`; chainId: number; approvedAt: number };

const KEY = "trezo_sessions_v1";

async function readAll(): Promise<Record<string, DAppSession>> {
  const out = await chrome.storage.local.get(KEY);
  return (out[KEY] as Record<string, DAppSession>) ?? {};
}
async function writeAll(sessions: Record<string, DAppSession>): Promise<void> {
  await chrome.storage.local.set({ [KEY]: sessions });
}

export const sessionStore = {
  async get(origin: string): Promise<DAppSession | null> {
    return (await readAll())[origin] ?? null;
  },
  async set(session: DAppSession): Promise<void> {
    const all = await readAll();
    all[session.origin] = session;
    await writeAll(all);
  },
  async remove(origin: string): Promise<void> {
    const all = await readAll();
    delete all[origin];
    await writeAll(all);
  },
};
```

- [ ] **Step 2: Replace `apps/extension/src/background.ts`**

```ts
import type { RpcRequestMsg, RpcResponseMsg } from "./types/messages";
import { sessionStore } from "./rpc/sessionStore";

const DEFAULT_CHAIN_ID = 84532; // Base Sepolia

console.log("[trezo-bg] service worker booted");

chrome.runtime.onMessage.addListener(
  (msg: RpcRequestMsg, _sender, sendResponse: (r: RpcResponseMsg) => void) => {
    if (msg?.type !== "trezo-rpc") return;
    void handle(msg).then(sendResponse);
    return true; // keep the message channel open for async response
  },
);

async function handle(msg: RpcRequestMsg): Promise<RpcResponseMsg> {
  const origin = msg.origin ?? "";
  const session = origin ? await sessionStore.get(origin) : null;
  try {
    switch (msg.method) {
      case "eth_chainId":
        return ok(msg.id, `0x${(session?.chainId ?? DEFAULT_CHAIN_ID).toString(16)}`);
      case "eth_accounts":
        return ok(msg.id, session ? [session.address] : []);
      case "net_version":
        return ok(msg.id, String(session?.chainId ?? DEFAULT_CHAIN_ID));
      default:
        return err(msg.id, -32601, `Method not supported yet: ${msg.method}`);
    }
  } catch (e) {
    return err(msg.id, -32603, e instanceof Error ? e.message : "Internal error");
  }
}

const ok = (id: string, result: unknown): RpcResponseMsg => ({ type: "trezo-rpc-response", id, result });
const err = (id: string, code: number, message: string): RpcResponseMsg => ({
  type: "trezo-rpc-response", id, error: { code, message },
});
```

- [ ] **Step 3: Build**

Run from `D:\trezo`: `npm run -w apps/extension build`
Expected: builds clean.

- [ ] **Step 4: Manual — verify EIP-6963 discovery (this is TC-10)**

1. Reload the unpacked extension at `chrome://extensions` (click the reload icon on the Trezo card).
2. Open the MetaMask Test Dapp: `https://metamask.github.io/test-dapp/`.
3. Scroll to "Detected providers" / EIP-6963 section. Observe: **Trezo** appears in the list.
4. Click "Connect" on the Trezo provider (it may error since accounts aren't wired yet — that's expected at this milestone).
5. In the dapp console (DevTools), run: `await window.ethereum.request({method:'eth_chainId'})` → returns `0x14a34` (84532).

Expected: Trezo is discoverable (step 3) and `eth_chainId` returns `0x14a34` (step 5). **TC-10 is satisfied at step 3.**

- [ ] **Step 5: Commit**

```
git add apps/extension/src/rpc/sessionStore.ts apps/extension/src/background.ts
git commit -m "feat(extension): background stub router (chainId/accounts) + per-origin sessions — TC-10 met"
```

---

## Milestone 2 — Port the AA core + config (unit-tested)

Outcome: the UserOp builder runs in the extension's bundle, proven by a vitest unit test for a pure function.

### Task 2.1: Copy deployment data + ABIs + chains

**Files:**
- Create: `apps/extension/src/core/deployments.json` (from `contracts/deployments/releases/` Base Sepolia, or `apps/mobile/src/integration/viem/deployments.ts` data for base-sepolia)
- Create: `apps/extension/src/core/abis.ts`
- Create: `apps/extension/src/core/chains.ts`

- [ ] **Step 1: Extract Base Sepolia deployment addresses**

Read the mobile deployment source to find the base-sepolia addresses:
```
type apps\mobile\src\integration\viem\deployments.ts
```
Locate the base-sepolia entry and copy these fields into `apps/extension/src/core/deployments.json`:

```json
{
  "chainId": 84532,
  "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  "accountFactory": "<copy from mobile deployments base-sepolia>",
  "passkeyValidator": "<copy from mobile deployments base-sepolia>",
  "smartAccountImpl": "<copy if present>"
}
```
Replace each `<...>` with the actual address from the mobile source. (EntryPoint v0.7 canonical address shown; verify it matches the mobile config.)

- [ ] **Step 2: Copy the ABIs used by the UserOp path**

Copy these JSON ABIs into `apps/extension/src/core/` and re-export them from `abis.ts`:
- `apps/mobile/src/integration/abi/SmartAccount.json`
- `apps/mobile/src/integration/abi/AccountFactory.json`
- `apps/mobile/src/integration/abi/PasskeyValidator.json`

`apps/extension/src/core/abis.ts`:
```ts
import smartAccount from "./SmartAccount.json";
import accountFactory from "./AccountFactory.json";
import passkeyValidator from "./PasskeyValidator.json";

export const ABIS = {
  smartAccount: smartAccount as unknown as import("viem").Abi,
  accountFactory: accountFactory as unknown as import("viem").Abi,
  passkeyValidator: passkeyValidator as unknown as import("viem").Abi,
};
```

- [ ] **Step 3: `apps/extension/src/core/chains.ts`**

```ts
import { defineChain } from "viem";
import { EXTENSION_CONFIG } from "./config";

export const baseSepolia = defineChain({
  id: EXTENSION_CONFIG.chainId,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [EXTENSION_CONFIG.rpcUrl] }, public: { http: [EXTENSION_CONFIG.rpcUrl] } },
  testnet: true,
});
```

- [ ] **Step 4: Commit**

```
git add apps/extension/src/core/
git commit -m "feat(extension): copy Base Sepolia deployment data + ABIs + chain def"
```

### Task 2.2: Config from env

**Files:**
- Create: `apps/extension/src/core/config.ts`, `apps/extension/.env.local`, `apps/extension/.env.example`

- [ ] **Step 1: `apps/extension/src/core/config.ts`**

```ts
import deployments from "./deployments.json";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env ${name}. Set it in apps/extension/.env.local`);
  return value;
}

export const EXTENSION_CONFIG = {
  chainId: 84532 as const,
  rpcUrl: required("VITE_BASE_SEPOLIA_RPC_URL", import.meta.env.VITE_BASE_SEPOLIA_RPC_URL),
  bundlerUrl: required("VITE_BASE_SEPOLIA_BUNDLER_URL", import.meta.env.VITE_BASE_SEPOLIA_BUNDLER_URL),
  paymasterUrl: required("VITE_BASE_SEPOLIA_PAYMASTER_URL", import.meta.env.VITE_BASE_SEPOLIA_PAYMASTER_URL),
  rpId: import.meta.env.VITE_PASSKEY_RP_ID || "abubakar-tq.github.io",
  supabaseUrl: required("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
  deployment: deployments,
};
```

- [ ] **Step 2: `apps/extension/.env.example`** (commit this) and `.env.local` (gitignored, real values)

`.env.example`:
```
VITE_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VITE_BASE_SEPOLIA_BUNDLER_URL=https://api.pimlico.io/v2/84532/rpc?apikey=YOUR_KEY
VITE_BASE_SEPOLIA_PAYMASTER_URL=https://api.pimlico.io/v2/84532/rpc?apikey=YOUR_KEY
VITE_PASSKEY_RP_ID=abubakar-tq.github.io
VITE_SUPABASE_URL=https://YOUR.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Copy the real Pimlico/Supabase values from the mobile `.env` (find them in `apps/mobile/.env` under `EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL`, `EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) into `.env.local`.

- [ ] **Step 3: Ensure `.env.local` is gitignored**

Confirm: `git check-ignore apps/extension/.env.local` prints the path. If not, add `apps/extension/.env.local` to root `.gitignore` and commit that.

- [ ] **Step 4: Commit**

```
git add apps/extension/src/core/config.ts apps/extension/.env.example
git commit -m "feat(extension): env-driven Base Sepolia config"
```

### Task 2.3: Copy clients + userOps + revertDecoding (strip RN)

**Files:**
- Create: `apps/extension/src/core/clients.ts`, `apps/extension/src/core/revertDecoding.ts`, `apps/extension/src/core/userOps.ts`

- [ ] **Step 1: `apps/extension/src/core/clients.ts`** (browser viem client; no `networks.ts` coupling)

```ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "./chains";
import { EXTENSION_CONFIG } from "./config";

export const getPublicClient = (_chainId: number = EXTENSION_CONFIG.chainId) =>
  createPublicClient({ chain: baseSepolia, transport: http(EXTENSION_CONFIG.rpcUrl, { timeout: 60_000 }) });

// userOps.ts uses getViemChain(chainId) for client transport selection.
export const getViemChain = (_chainId: number = EXTENSION_CONFIG.chainId) => baseSepolia;
```

- [ ] **Step 2: Copy `revertDecoding.ts`**

```
copy apps\mobile\src\integration\viem\revertDecoding.ts apps\extension\src\core\revertDecoding.ts
```
Then edit the copy: remove any `__DEV__` references (replace `if (__DEV__)` with `if (false)` or delete debug-only blocks). It has no RN imports otherwise.

- [ ] **Step 3: Copy `userOps.ts` and rewire imports**

```
copy apps\mobile\src\integration\viem\userOps.ts apps\extension\src\core\userOps.ts
```
Edit the copy's import block to point at the local core modules and drop RN:
- Change `import { ABIS } from "./abis";` → keep (local `abis.ts` exists).
- Change `import { getDeployment } from "./deployments";` → replace with a local helper:
  ```ts
  import deployment from "./deployments.json";
  const getDeployment = (_chainId: number) => deployment;
  ```
- Change `import { getPublicClient, getViemChain } from "./clients";` → keep (local `clients.ts` exists).
- Change `import type { SupportedChainId } from "../chains";` → `type SupportedChainId = number;`
- Replace the `debugLog`/`debugError` definitions:
  ```ts
  const debugLog = (..._a: unknown[]) => {};
  const debugError = (...a: unknown[]) => console.error(...a);
  ```
- Remove `import { collectErrorData, decodeDelegateAndRevert, decodeFailedOp, decodeRevertString } from "./revertDecoding";` only if unused; otherwise keep (local copy exists).

Do not change any logic. Keep all exported function names identical (`buildSmartAccountExecutionUserOp`, `submitConfiguredUserOp`, `waitForUserOperationReceipt`, etc.).

- [ ] **Step 4: Type-check**

Run from `D:\trezo`: `npm run -w apps/extension build`
Expected: builds; fix only import/type errors, never logic.

- [ ] **Step 5: Commit**

```
git add apps/extension/src/core/clients.ts apps/extension/src/core/revertDecoding.ts apps/extension/src/core/userOps.ts
git commit -m "feat(extension): port viem clients + UserOp builder (RN-free)"
```

### Task 2.4: Unit-test a pure core function

**Files:**
- Create: `apps/extension/src/core/userOps.test.ts`

- [ ] **Step 1: Write the failing test** (uses the real `getUserOperationHash` path via a known input)

```ts
import { describe, it, expect } from "vitest";
import { encodeFunctionData } from "viem";
import { ABIS } from "./abis";

describe("smartAccount.execute encoding", () => {
  it("encodes execute(target,value,data) deterministically", () => {
    const data = encodeFunctionData({
      abi: ABIS.smartAccount,
      functionName: "execute",
      args: ["0x000000000000000000000000000000000000dEaD", 0n, "0x"],
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run — verify it passes** (proves ABI + viem load in the extension package)

Run from `D:\trezo`: `npm run -w apps/extension test`
Expected: 1 passing test. If `execute` is not in the ABI, the test throws — fix the ABI copy.

- [ ] **Step 3: Commit**

```
git add apps/extension/src/core/userOps.test.ts
git commit -m "test(extension): core ABI/encoding smoke test"
```

---

## Milestone 3 — WebAuthn + passkey encode (unit-tested)

Outcome: browser passkey create/get works in the popup; the DER/encode logic is unit-tested with a known vector.

### Task 3.1: Port the encode logic with a browser adapter

**Files:**
- Create: `apps/extension/src/passkey/encode.ts`

- [ ] **Step 1: Write `encode.ts`** — copy the pure encode helpers from `apps/mobile/src/features/wallet/services/PasskeyService.ts` (`parseDERSignature`, the low-s normalization, `encodeSignatureForContract`, and the base64url/hex helpers) as standalone functions, plus a browser adapter that converts an `AuthenticatorAssertionResponse` (ArrayBuffers) into the shape `parseWebAuthnSignature` expects (base64url strings).

```ts
import { encodeAbiParameters, parseAbiParameters } from "viem";

const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_HALF_N = P256_N / 2n;

export interface PasskeySignature {
  passkeyId: string; authenticatorData: string; clientDataJSON: string;
  challengeIndex: number; typeIndex: number; r: string; s: string;
}

// ---- byte helpers ----
export const bufToBase64Url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
const base64UrlToBytes = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytesToHex = (b: Uint8Array): string =>
  "0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

// ---- DER signature parse with low-s (verbatim logic from PasskeyService.parseDERSignature) ----
function parseDERSignature(der: Uint8Array): { r: string; s: string } {
  if (der[0] !== 0x30) throw new Error("Invalid DER: missing sequence");
  let off = 2;
  if (der[off] !== 0x02) throw new Error("Invalid DER: missing r");
  off++;
  const rLen = der[off]; off++;
  let r = der.slice(off, off + rLen); off += rLen;
  if (r[0] === 0x00 && r.length === 33) r = r.slice(1);
  if (der[off] !== 0x02) throw new Error("Invalid DER: missing s");
  off++;
  const sLen = der[off]; off++;
  let s = der.slice(off, off + sLen);
  if (s[0] === 0x00 && s.length === 33) s = s.slice(1);
  const rPad = new Uint8Array(32); rPad.set(r, 32 - r.length);
  const sPad = new Uint8Array(32); sPad.set(s, 32 - s.length);
  let sBig = BigInt(bytesToHex(sPad));
  if (sBig > P256_HALF_N) sBig = P256_N - sBig; // normalize to low-s
  return { r: bytesToHex(rPad), s: `0x${sBig.toString(16).padStart(64, "0")}` };
}

// credentialId (base64url) -> bytes32 (right zero-padded)
export const credentialIdToBytes32 = (credentialId: string): string => {
  const decoded = base64UrlToBytes(credentialId);
  const padded = new Uint8Array(32);
  padded.set(decoded.slice(0, Math.min(decoded.length, 32)));
  return bytesToHex(padded);
};

// Browser AuthenticatorAssertionResponse -> contract signature
export function parseWebAuthnAssertion(
  resp: AuthenticatorAssertionResponse,
  passkeyIdRaw: string,
): PasskeySignature {
  const authenticatorData = bytesToHex(new Uint8Array(resp.authenticatorData));
  const clientDataJSON = new TextDecoder().decode(resp.clientDataJSON);
  const challengeIndex = clientDataJSON.indexOf('"challenge"');
  const typeIndex = clientDataJSON.indexOf('"type"');
  const { r, s } = parseDERSignature(new Uint8Array(resp.signature));
  return { passkeyId: passkeyIdRaw, authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s };
}

export function encodeSignatureForContract(sig: PasskeySignature): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters("bytes32, bytes, string, uint256, uint256, uint256, uint256"),
    [
      sig.passkeyId as `0x${string}`,
      sig.authenticatorData as `0x${string}`,
      sig.clientDataJSON,
      BigInt(sig.challengeIndex),
      BigInt(sig.typeIndex),
      BigInt(sig.r),
      BigInt(sig.s),
    ],
  ) as `0x${string}`;
}

// COSE/SPKI public-key parse (port of normalizePublicKey/parseSpkiOrRaw from PasskeyService).
export function extractP256PublicKey(spkiOrRaw: ArrayBuffer): { x: string; y: string } {
  const k = new Uint8Array(spkiOrRaw);
  if (k.length === 65 && k[0] === 0x04) return { x: bytesToHex(k.slice(1, 33)), y: bytesToHex(k.slice(33, 65)) };
  if (k.length === 64) return { x: bytesToHex(k.slice(0, 32)), y: bytesToHex(k.slice(32, 64)) };
  if (k.length > 70 && k[0] === 0x30) {
    for (let i = 0; i < k.length; i++) {
      if (k[i] === 0x04 && i + 65 <= k.length) {
        const p = k.slice(i + 1, i + 65);
        return { x: bytesToHex(p.slice(0, 32)), y: bytesToHex(p.slice(32, 64)) };
      }
    }
  }
  throw new Error("Unsupported public key format");
}
```

- [ ] **Step 2: Commit**

```
git add apps/extension/src/passkey/encode.ts
git commit -m "feat(extension): passkey encode + browser assertion adapter (low-s, EIP-1271 envelope)"
```

### Task 3.2: Unit-test the DER → low-s → ABI encode path

**Files:**
- Create: `apps/extension/src/passkey/encode.test.ts`

- [ ] **Step 1: Write the test** (known DER signature, assert low-s and stable ABI encoding)

```ts
import { describe, it, expect } from "vitest";
import { encodeSignatureForContract, credentialIdToBytes32 } from "./encode";

describe("encodeSignatureForContract", () => {
  it("produces a stable ABI-encoded envelope", () => {
    const sig = {
      passkeyId: credentialIdToBytes32("AAAA"),
      authenticatorData: "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000",
      clientDataJSON: '{"type":"webauthn.get","challenge":"abc","origin":"chrome-extension://x"}',
      challengeIndex: 22,
      typeIndex: 1,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };
    const encoded = encodeSignatureForContract(sig);
    expect(encoded.startsWith("0x")).toBe(true);
    expect(encoded.length).toBeGreaterThan(200);
  });

  it("credentialIdToBytes32 right-pads to 32 bytes", () => {
    const out = credentialIdToBytes32("AAAA"); // 3 bytes decoded
    expect(out).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run — verify pass**

Run from `D:\trezo`: `npm run -w apps/extension test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add apps/extension/src/passkey/encode.test.ts
git commit -m "test(extension): passkey encode envelope + credentialId padding"
```

### Task 3.3: WebAuthn service (create/get) + metadata storage

**Files:**
- Create: `apps/extension/src/passkey/webauthnService.ts`

- [ ] **Step 1: Write the service** (runs ONLY in the popup/extension-page context)

```ts
import { EXTENSION_CONFIG } from "../core/config";
import { bufToBase64Url, credentialIdToBytes32, extractP256PublicKey, parseWebAuthnAssertion, encodeSignatureForContract, type PasskeySignature } from "./encode";

export interface PasskeyMetadata {
  credentialId: string; credentialIdRaw: string;
  publicKeyX: string; publicKeyY: string; rpId: string;
  deviceName: string; deviceType: "extension"; createdAt: string;
}

const STORAGE_KEY = "trezo_passkey_v1";

const utf8ToBytes = (s: string) => new TextEncoder().encode(s);
const hexToBytes = (hex: string) => {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32));

export const WebAuthnService = {
  async getStored(): Promise<PasskeyMetadata | null> {
    const out = await chrome.storage.local.get(STORAGE_KEY);
    return (out[STORAGE_KEY] as PasskeyMetadata) ?? null;
  },

  async create(userId: string): Promise<PasskeyMetadata> {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: "Trezo Wallet", id: EXTENSION_CONFIG.rpId },
        user: { id: utf8ToBytes(userId), name: userId, displayName: `Trezo ${userId.slice(0, 8)}` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 / P-256
        timeout: 60_000,
        attestation: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
      },
    })) as PublicKeyCredential;

    const att = cred.response as AuthenticatorAttestationResponse;
    const pub = att.getPublicKey();
    if (!pub) throw new Error("Authenticator did not return a public key");
    const { x, y } = extractP256PublicKey(pub);
    const credentialId = bufToBase64Url(cred.rawId);
    const meta: PasskeyMetadata = {
      credentialId,
      credentialIdRaw: credentialIdToBytes32(credentialId),
      publicKeyX: x, publicKeyY: y,
      rpId: EXTENSION_CONFIG.rpId,
      deviceName: "Chrome Extension",
      deviceType: "extension",
      createdAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: meta });
    return meta;
  },

  async sign(challengeHex: string): Promise<PasskeySignature> {
    const meta = await this.getStored();
    if (!meta) throw new Error("No passkey on this device. Pair the extension first.");
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: hexToBytes(challengeHex),
        rpId: meta.rpId,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [
          { type: "public-key", id: hexToBytes(credentialIdToBytes32(meta.credentialId)).slice(0, 0) === undefined ? new Uint8Array() : base64UrlToRaw(meta.credentialId) },
        ],
      },
    })) as PublicKeyCredential;
    const resp = assertion.response as AuthenticatorAssertionResponse;
    return parseWebAuthnAssertion(resp, meta.credentialIdRaw);
  },

  encodeForContract: encodeSignatureForContract,
};

function base64UrlToRaw(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
```

> Note for the executor: simplify the `allowCredentials` line to `[{ type: "public-key", id: base64UrlToRaw(meta.credentialId) }]` — the ternary above is intentionally redundant and must be cleaned up to exactly that. The `id` must be the raw (untruncated) credential id bytes, NOT the bytes32 form.

- [ ] **Step 2: Fix the allowCredentials line**

Replace the `allowCredentials: [...]` block with:
```ts
        allowCredentials: [{ type: "public-key", id: base64UrlToRaw(meta.credentialId) }],
```

- [ ] **Step 3: Build**

Run from `D:\trezo`: `npm run -w apps/extension build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```
git add apps/extension/src/passkey/webauthnService.ts
git commit -m "feat(extension): WebAuthn create/get service (platform authenticator, chrome.storage metadata)"
```

---

## Milestone 4 — Supabase auth + device pairing

Outcome: user logs in; extension pairs as a new device on the existing AA; after phone approval it controls the same address.

### Task 4.1: Supabase client + auth service

**Files:**
- Create: `apps/extension/src/auth/supabaseClient.ts`, `apps/extension/src/auth/authService.ts`

- [ ] **Step 1: `supabaseClient.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { EXTENSION_CONFIG } from "../core/config";

export const supabase = createClient(EXTENSION_CONFIG.supabaseUrl, EXTENSION_CONFIG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "trezo_ext_auth" },
});
```

- [ ] **Step 2: `authService.ts`**

```ts
import { supabase } from "./supabaseClient";

export const AuthService = {
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  },
  async signInWithGoogle() {
    // chrome extension OAuth uses the extension's redirect URL
    const redirectTo = chrome.identity?.getRedirectURL?.() ?? chrome.runtime.getURL("index.html");
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw new Error(error.message);
    return data;
  },
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
};
```

> Note: Google OAuth in MV3 may require the `identity` permission + a web-flow. For v1 the **email/password path is the primary, demoable flow** (matches the testnet-demoable rule). Google is best-effort; if it complicates the build, gate it behind a feature flag and demo email login.

- [ ] **Step 3: Add `identity` permission (only if Google path is kept)**

Edit `manifest.config.ts` `permissions` → add `"identity"`. Skip if email-only.

- [ ] **Step 4: Commit**

```
git add apps/extension/src/auth/
git commit -m "feat(extension): Supabase client + email/Google auth service"
```

### Task 4.2: Port DevicePairingService (chrome.storage + Web Crypto)

**Files:**
- Reference source: `apps/mobile/src/features/wallet/services/DevicePairingService.ts`
- Create: `apps/extension/src/pairing/devicePairingService.ts`

- [ ] **Step 1: Copy + adapt**

Copy the mobile `DevicePairingService.ts` and apply these substitutions (logic otherwise unchanged):
- `import { getSupabaseClient } from "@/src/lib/supabase";` → `import { supabase } from "../auth/supabaseClient";` and replace every `const supabase = getSupabaseClient();` with using the imported `supabase` directly (delete those local lines).
- Remove `import AsyncStorage ...` and `import * as Crypto from "expo-crypto";` and `import PasskeyService ...` and the viem on-chain helpers that aren't needed by the extension's new-device role (`getPasskeyOnchainState`, `isContractDeployed`, `ensureLocalDeviceSynced`, `syncWalletDevicesFromChain`, `syncDeviceRemovalState` — these are phone/management-side; the extension only needs `getPairingRequestForUser`, `submitNewDevicePasskey`, and reading status).
- Replace `sha256`:
  ```ts
  const sha256 = async (input: string): Promise<string> => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  ```
- Replace `Crypto.getRandomBytesAsync(32)` usage (only in `createPairingRequest`, which is phone-side; the extension does not create requests — DELETE `createPairingRequest`, `parsePairingDeepLink`, `stash/get/consume/clearPendingDeepLink` which use AsyncStorage).
- Keep `getPairingRequestForUser` and `submitNewDevicePasskey` exactly (they only use supabase + sha256).

Resulting file exports a class with at least: `getPairingRequestForUser`, `submitNewDevicePasskey`, and a new `pollUntilApproved` helper:
```ts
  static async pollUntilApproved(params: { requestId: string; secret: string; userId: string; timeoutMs?: number }) {
    const deadline = Date.now() + (params.timeoutMs ?? 180_000);
    while (Date.now() < deadline) {
      const req = await this.getPairingRequestForUser(params);
      if (req.status === "approved") return req;
      if (["rejected", "expired", "failed"].includes(req.status)) throw new Error(`Pairing ${req.status}`);
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new Error("Pairing timed out waiting for approval");
  }
```
(Reuse the `DevicePairingRequest` type verbatim from the source.)

- [ ] **Step 2: Build / type-check**

Run from `D:\trezo`: `npm run -w apps/extension build`
Expected: builds; fix imports only.

- [ ] **Step 3: Commit**

```
git add apps/extension/src/pairing/devicePairingService.ts
git commit -m "feat(extension): device pairing (new-device role) over chrome.storage + Web Crypto"
```

### Task 4.3: Wallet address resolution after pairing

**Files:**
- Create: `apps/extension/src/pairing/walletResolver.ts`

- [ ] **Step 1: Resolve the AA address for the logged-in user**

The pairing request row carries `wallet_address`. Persist it locally after approval.

```ts
import { supabase } from "../auth/supabaseClient";

const KEY = "trezo_wallet_v1";
export type StoredWallet = { address: `0x${string}`; chainId: number };

export const WalletResolver = {
  async save(w: StoredWallet) { await chrome.storage.local.set({ [KEY]: w }); },
  async get(): Promise<StoredWallet | null> {
    const out = await chrome.storage.local.get(KEY);
    return (out[KEY] as StoredWallet) ?? null;
  },
  // Fallback: read the user's AA wallet row directly if not paired via a request.
  async fromSupabase(userId: string): Promise<StoredWallet | null> {
    const { data } = await supabase.from("aa_wallets").select("address, chain_id").eq("user_id", userId).maybeSingle();
    if (!data?.address) return null;
    return { address: data.address as `0x${string}`, chainId: (data.chain_id as number) ?? 84532 };
  },
};
```

> Verify the table/column names (`aa_wallets`, `address`, `chain_id`) against the mobile `SupabaseWalletService.getAAWallet` query and correct if different.

- [ ] **Step 2: Commit**

```
git add apps/extension/src/pairing/walletResolver.ts
git commit -m "feat(extension): persist paired wallet address"
```

### Task 4.4: Login + Pairing popup screens

**Files:**
- Create: `apps/extension/src/popup/screens/LoginScreen.tsx`, `apps/extension/src/popup/screens/PairDeviceScreen.tsx`, `apps/extension/src/popup/screens/HomeScreen.tsx`
- Modify: `apps/extension/src/popup/App.tsx`

- [ ] **Step 1: `LoginScreen.tsx`**

```tsx
import { useState } from "react";
import { AuthService } from "../../auth/authService";

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ padding: 20 }}>
      <h2>Sign in to Trezo</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
      <button disabled={busy} style={btn} onClick={async () => {
        setBusy(true); setErr(null);
        try { await AuthService.signInWithEmail(email, password); onDone(); }
        catch (e) { setErr(e instanceof Error ? e.message : "Login failed"); }
        finally { setBusy(false); }
      }}>{busy ? "Signing in…" : "Sign in"}</button>
    </div>
  );
}
const inp: React.CSSProperties = { display: "block", width: "100%", margin: "8px 0", padding: 10, borderRadius: 8, border: "1px solid #333", background: "#16161c", color: "#fff" };
const btn: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700, marginTop: 8 };
```

- [ ] **Step 2: `PairDeviceScreen.tsx`** (new-device half of the flow)

```tsx
import { useState } from "react";
import { AuthService } from "../../auth/authService";
import { DevicePairingService } from "../../pairing/devicePairingService";
import { WebAuthnService } from "../../passkey/webauthnService";
import { WalletResolver } from "../../pairing/walletResolver";

export function PairDeviceScreen({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState(""); // "requestId:secret" from the phone QR/code
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  async function pair() {
    setErr(null);
    try {
      const user = await AuthService.getUser();
      if (!user) throw new Error("Sign in first");
      const [requestId, secret] = code.trim().split(":");
      if (!requestId || !secret) throw new Error("Code must be requestId:secret");

      setStatus("Loading pairing request…");
      const req = await DevicePairingService.getPairingRequestForUser({ requestId, secret, userId: user.id });

      setStatus("Creating passkey (Windows Hello)…");
      const meta = await WebAuthnService.create(user.id);

      setStatus("Submitting passkey, waiting for phone approval…");
      await DevicePairingService.submitNewDevicePasskey({
        requestId, secret, userId: user.id,
        passkeyId: meta.credentialIdRaw, credentialId: meta.credentialId,
        publicKeyX: meta.publicKeyX, publicKeyY: meta.publicKeyY,
        deviceName: meta.deviceName, platform: "extension",
      });

      const approved = await DevicePairingService.pollUntilApproved({ requestId, secret, userId: user.id });
      await WalletResolver.save({ address: approved.wallet_address as `0x${string}`, chainId: approved.chain_id });
      setStatus("Paired!");
      onPaired();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Pairing failed");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Pair this extension</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>On your phone: Profile → Devices → Pair New Device. Paste the code shown.</p>
      <input placeholder="requestId:secret" value={code} onChange={(e) => setCode(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "8px 0", borderRadius: 8, border: "1px solid #333", background: "#16161c", color: "#fff" }} />
      <button style={{ width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700 }} onClick={pair}>Pair device</button>
      {status && <p style={{ opacity: 0.8 }}>{status}</p>}
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
    </div>
  );
}
```

> Phone-side QR currently encodes a deep link `trezowallet://pair-device?requestId=...&secret=...`. For the extension, the user pastes `requestId:secret`. **Add a tiny phone-side affordance** (separate small task in the mobile app, optional) to also show the raw `requestId:secret` text under the QR. If you don't want to touch mobile, read the two values from the deep link manually during the demo.

- [ ] **Step 3: `HomeScreen.tsx`**

```tsx
import { useEffect, useState } from "react";
import { WalletResolver } from "../../pairing/walletResolver";

export function HomeScreen() {
  const [addr, setAddr] = useState<string>("");
  useEffect(() => { WalletResolver.get().then((w) => setAddr(w?.address ?? "")); }, []);
  return (
    <div style={{ padding: 20 }}>
      <h2>Trezo</h2>
      <p style={{ opacity: 0.7, fontSize: 12 }}>Smart account</p>
      <code style={{ fontSize: 12, wordBreak: "break-all" }}>{addr || "Not paired"}</code>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `App.tsx` to route**

```tsx
import { useEffect, useState } from "react";
import { AuthService } from "../auth/authService";
import { WalletResolver } from "../pairing/walletResolver";
import { LoginScreen } from "./screens/LoginScreen";
import { PairDeviceScreen } from "./screens/PairDeviceScreen";
import { HomeScreen } from "./screens/HomeScreen";

type Screen = "loading" | "login" | "pair" | "home";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  async function refresh() {
    const user = await AuthService.getUser();
    if (!user) return setScreen("login");
    const wallet = await WalletResolver.get();
    setScreen(wallet ? "home" : "pair");
  }
  useEffect(() => { void refresh(); }, []);
  if (screen === "loading") return <div style={{ padding: 20 }}>Loading…</div>;
  if (screen === "login") return <LoginScreen onDone={refresh} />;
  if (screen === "pair") return <PairDeviceScreen onPaired={refresh} />;
  return <HomeScreen />;
}
```

- [ ] **Step 5: Build + manual pairing test**

1. Build: `npm run -w apps/extension build`; reload the unpacked extension.
2. Open the popup → Login with your Trezo email/password.
3. On the phone app: Profile → Devices → Pair New Device → note the `requestId` and `secret` from the QR deep link.
4. In the popup pair screen, paste `requestId:secret` → "Pair device".
5. Windows Hello prompt appears → approve. (If no hardware, use DevTools → WebAuthn → "Add virtual authenticator" (ctap2, internal, resident keys + user verification ON) before clicking pair.)
6. On the phone: approve the pending device → it signs `addPasskey` and the tx confirms.
7. Popup shows "Paired!" → Home shows the **same AA address** as the phone.

Expected: same address on phone and extension; phone needed only for this approval.

- [ ] **Step 6: Commit**

```
git add apps/extension/src/popup
git commit -m "feat(extension): login + new-device pairing wizard + home (same AA address)"
```

---

## Milestone 5 — Connect + Sign (via popup WebAuthn)

Outcome: dApps connect (popup approval) and `personal_sign`/`signTypedData_v4` return EIP-1271-verifiable signatures.

### Task 5.1: Approval bridge (background ↔ popup)

**Files:**
- Create: `apps/extension/src/popup/lib/approvalBridge.ts`
- Create: `apps/extension/src/rpc/approvalManager.ts`

- [ ] **Step 1: `approvalManager.ts`** (background side — opens popup, awaits result)

```ts
type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pending = new Map<string, Pending>();

export type ApprovalRequest =
  | { kind: "connect"; id: string; origin: string }
  | { kind: "sign"; id: string; origin: string; message: string }
  | { kind: "signTyped"; id: string; origin: string; typedData: unknown }
  | { kind: "tx"; id: string; origin: string; tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` } };

const QUEUE_KEY = "trezo_approval_queue_v1";

export async function requestApproval(req: ApprovalRequest): Promise<unknown> {
  const queue = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY] ?? [];
  queue.push(req);
  await chrome.storage.session.set({ [QUEUE_KEY]: queue });
  await chrome.action.openPopup().catch(() => chrome.windows.create({ url: chrome.runtime.getURL("index.html"), type: "popup", width: 380, height: 600 }));
  return new Promise((resolve, reject) => pending.set(req.id, { resolve, reject }));
}

chrome.runtime.onMessage.addListener((msg: { type?: string; id?: string; result?: unknown; error?: string }) => {
  if (msg?.type !== "trezo-approval-result" || !msg.id) return;
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(msg.error));
  else p.resolve(msg.result);
});
```

> Note: `chrome.action.openPopup()` requires Chrome 127+ and a user context; the fallback `chrome.windows.create` opens an approval window if the programmatic popup is unavailable. Add `"windows"` is not a permission; no change needed. Use `chrome.storage.session` (in-memory) for the queue so secrets never hit disk.

- [ ] **Step 2: `approvalBridge.ts`** (popup side — reads queue, returns result)

```ts
const QUEUE_KEY = "trezo_approval_queue_v1";

export async function nextApproval() {
  const queue = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY] ?? [];
  return queue[0] ?? null;
}
export async function resolveApproval(id: string, result: unknown) {
  await dequeue(id);
  chrome.runtime.sendMessage({ type: "trezo-approval-result", id, result });
}
export async function rejectApproval(id: string, error: string) {
  await dequeue(id);
  chrome.runtime.sendMessage({ type: "trezo-approval-result", id, error });
}
async function dequeue(id: string) {
  const queue = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY] ?? [];
  await chrome.storage.session.set({ [QUEUE_KEY]: queue.filter((r: { id: string }) => r.id !== id) });
}
```

- [ ] **Step 3: Commit**

```
git add apps/extension/src/rpc/approvalManager.ts apps/extension/src/popup/lib/approvalBridge.ts
git commit -m "feat(extension): background<->popup approval bridge (session-only queue)"
```

### Task 5.2: Port the RPC router (approvals via popup)

**Files:**
- Reference source: `apps/mobile/src/features/browser/web/rpcRouter.ts`
- Create: `apps/extension/src/rpc/rpcRouter.ts`
- Modify: `apps/extension/src/background.ts`

- [ ] **Step 1: Write `rpcRouter.ts`** — same method set/codes as mobile; approvals call `requestApproval`.

```ts
import type { RpcResponseMsg } from "../types/messages";
import { sessionStore } from "./sessionStore";
import { requestApproval } from "./approvalManager";
import { WalletResolver } from "../pairing/walletResolver";
import { EXTENSION_CONFIG } from "../core/config";

const DEFAULT_CHAIN_ID = EXTENSION_CONFIG.chainId;
const rid = () => Math.random().toString(36).slice(2);
const ok = (id: string, result: unknown): RpcResponseMsg => ({ type: "trezo-rpc-response", id, result });
const fail = (id: string, code: number, message: string): RpcResponseMsg => ({ type: "trezo-rpc-response", id, error: { code, message } });

export async function handleRpc(id: string, method: string, params: unknown[], origin: string): Promise<RpcResponseMsg> {
  const session = await sessionStore.get(origin);
  try {
    switch (method) {
      case "eth_chainId": return ok(id, `0x${(session?.chainId ?? DEFAULT_CHAIN_ID).toString(16)}`);
      case "net_version": return ok(id, String(session?.chainId ?? DEFAULT_CHAIN_ID));
      case "eth_accounts": return ok(id, session ? [session.address] : []);

      case "eth_requestAccounts": {
        if (session) return ok(id, [session.address]);
        const wallet = await WalletResolver.get();
        if (!wallet) return fail(id, 4100, "Extension not paired. Open Trezo and pair first.");
        const approved = await requestApproval({ kind: "connect", id: rid(), origin });
        if (!approved) return fail(id, 4001, "User rejected");
        await sessionStore.set({ origin, address: wallet.address, chainId: wallet.chainId, approvedAt: Date.now() });
        return ok(id, [wallet.address]);
      }

      case "personal_sign": {
        if (!session) return fail(id, 4100, "Unauthorized");
        const [hexMessage] = params as [`0x${string}`];
        const sig = await requestApproval({ kind: "sign", id: rid(), origin, message: hexMessage });
        if (!sig) return fail(id, 4001, "User rejected");
        return ok(id, sig);
      }

      case "eth_signTypedData_v4": {
        if (!session) return fail(id, 4100, "Unauthorized");
        const [, typedDataRaw] = params as [string, unknown];
        const typedData = typeof typedDataRaw === "string" ? JSON.parse(typedDataRaw) : typedDataRaw;
        const sig = await requestApproval({ kind: "signTyped", id: rid(), origin, typedData });
        if (!sig) return fail(id, 4001, "User rejected");
        return ok(id, sig);
      }

      case "eth_sendTransaction": {
        if (!session) return fail(id, 4100, "Unauthorized");
        const [tx] = params as [{ to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` }];
        const hash = await requestApproval({ kind: "tx", id: rid(), origin, tx });
        if (!hash) return fail(id, 4001, "User rejected");
        return ok(id, hash);
      }

      case "wallet_switchEthereumChain": {
        const [{ chainId }] = params as [{ chainId: string }];
        if (parseInt(chainId, 16) !== DEFAULT_CHAIN_ID) return fail(id, 4902, "Unrecognized chain");
        return ok(id, null);
      }

      default: return fail(id, -32601, `Method not supported: ${method}`);
    }
  } catch (e) {
    return fail(id, -32603, e instanceof Error ? e.message : "Internal error");
  }
}
```

- [ ] **Step 2: Wire it into `background.ts`** — replace the inline `handle` from Task 1.4 with a delegate to `handleRpc`:

```ts
import type { RpcRequestMsg, RpcResponseMsg } from "./types/messages";
import { handleRpc } from "./rpc/rpcRouter";
import "./rpc/approvalManager"; // registers the approval-result listener

console.log("[trezo-bg] service worker booted");

chrome.runtime.onMessage.addListener(
  (msg: RpcRequestMsg, _sender, sendResponse: (r: RpcResponseMsg) => void) => {
    if (msg?.type !== "trezo-rpc") return;
    void handleRpc(msg.id, msg.method, msg.params, msg.origin ?? "").then(sendResponse);
    return true;
  },
);
```

- [ ] **Step 3: Commit**

```
git add apps/extension/src/rpc/rpcRouter.ts apps/extension/src/background.ts
git commit -m "feat(extension): full RPC router with popup-bridged approvals"
```

### Task 5.3: Connect + Sign sheets (popup) with WebAuthn

**Files:**
- Create: `apps/extension/src/popup/sheets/ConnectSheet.tsx`, `apps/extension/src/popup/sheets/SignSheet.tsx`
- Modify: `apps/extension/src/popup/App.tsx` (render an approval sheet when the queue is non-empty)

- [ ] **Step 1: `ConnectSheet.tsx`**

```tsx
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";

export function ConnectSheet({ req }: { req: { id: string; origin: string } }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Connect</h2>
      <p><b>{req.origin}</b> wants to connect to your Trezo wallet.</p>
      <button style={primary} onClick={() => resolveApproval(req.id, true)}>Connect</button>
      <button style={ghost} onClick={() => rejectApproval(req.id, "User rejected")}>Reject</button>
    </div>
  );
}
const primary: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700, marginTop: 12 };
const ghost: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#fff", marginTop: 8 };
```

- [ ] **Step 2: `SignSheet.tsx`** (runs WebAuthn here, in the popup)

```tsx
import { useState } from "react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { WebAuthnService } from "../../passkey/webauthnService";
import { WalletResolver } from "../../pairing/walletResolver";
import { getPublicClient } from "../../core/clients";
import { hashMessage, hexToString } from "viem";

export function SignSheet({ req }: { req: { id: string; origin: string; message: string } }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const text = (() => { try { return hexToString(req.message as `0x${string}`); } catch { return req.message; } })();

  async function sign() {
    setBusy(true); setErr(null);
    try {
      // EIP-191 personal_sign digest, then passkey-sign it; return the EIP-1271 envelope.
      const digest = hashMessage({ raw: req.message as `0x${string}` });
      const sig = await WebAuthnService.sign(digest);
      const encoded = WebAuthnService.encodeForContract(sig);
      // (Optional) sanity check via on-chain isValidSignature before returning:
      const wallet = await WalletResolver.get();
      if (wallet) {
        try {
          const res = await getPublicClient().readContract({
            address: wallet.address, abi: [{ name: "isValidSignature", type: "function", stateMutability: "view",
              inputs: [{ type: "bytes32" }, { type: "bytes" }], outputs: [{ type: "bytes4" }] }],
            functionName: "isValidSignature", args: [digest, encoded],
          });
          if (res !== "0x1626ba7e") console.warn("[trezo] isValidSignature did not return magic value", res);
        } catch (e) { console.warn("[trezo] isValidSignature check skipped", e); }
      }
      await resolveApproval(req.id, encoded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign failed");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Signature request</h2>
      <p style={{ opacity: 0.7, fontSize: 12 }}>{req.origin}</p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#16161c", padding: 12, borderRadius: 8, fontSize: 12 }}>{text}</pre>
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
      <button disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700 }} onClick={sign}>
        {busy ? "Waiting for Windows Hello…" : "Sign with passkey"}
      </button>
      <button style={{ width: "100%", padding: 12, marginTop: 8, borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#fff" }} onClick={() => rejectApproval(req.id, "User rejected")}>Reject</button>
    </div>
  );
}
```

> The EIP-1271 envelope returned here is what dApps verify off-chain. **Risk 2 from the spec:** confirm `0x1626ba7e` is returned (the warning logs if not). If it fails, inspect `_routeIsValidSignature` in `contracts/src/account/SmartAccount.sol` to learn whether the `bytes` must be prefixed with the validator address/selector, and wrap `encoded` accordingly.

- [ ] **Step 3: Render sheets in `App.tsx`** — poll the approval queue and show the right sheet.

Add to `App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { nextApproval } from "./lib/approvalBridge";
import { ConnectSheet } from "./sheets/ConnectSheet";
import { SignSheet } from "./sheets/SignSheet";
// ...existing imports

// inside App(), before the screen routing return:
const [approval, setApproval] = useState<any>(null);
useEffect(() => {
  const tick = () => nextApproval().then(setApproval);
  tick();
  const interval = setInterval(tick, 500);
  return () => clearInterval(interval);
}, []);
if (approval?.kind === "connect") return <ConnectSheet req={approval} />;
if (approval?.kind === "sign") return <SignSheet req={approval} />;
// (signTyped + tx sheets added in later tasks)
```

- [ ] **Step 4: Build + manual connect/sign test**

1. Build + reload. Ensure the extension is paired (Milestone 4).
2. Open `https://metamask.github.io/test-dapp/`. Under EIP-6963 pick **Trezo** → Connect → the Trezo popup opens → "Connect" → dapp shows your AA address.
3. Click "Personal Sign" in the test dapp → the Trezo popup shows the message → "Sign with passkey" → Windows Hello (or virtual authenticator) → dapp shows a signature.
4. Check the SW/popup console: `isValidSignature` returned `0x1626ba7e` (or a logged mismatch to investigate).

Expected: connect returns the AA address; personal_sign returns a signature; the 1271 check passes (or surfaces the exact mismatch to fix).

- [ ] **Step 5: Commit**

```
git add apps/extension/src/popup
git commit -m "feat(extension): connect + personal_sign sheets with popup WebAuthn (EIP-1271)"
```

### Task 5.4: Typed-data sign sheet

**Files:**
- Create: `apps/extension/src/popup/sheets/SignTypedSheet.tsx`
- Modify: `apps/extension/src/popup/App.tsx`

- [ ] **Step 1: `SignTypedSheet.tsx`**

```tsx
import { useState } from "react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { WebAuthnService } from "../../passkey/webauthnService";
import { hashTypedData } from "viem";

export function SignTypedSheet({ req }: { req: { id: string; origin: string; typedData: any } }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function sign() {
    setBusy(true); setErr(null);
    try {
      const digest = hashTypedData(req.typedData);
      const sig = await WebAuthnService.sign(digest);
      await resolveApproval(req.id, WebAuthnService.encodeForContract(sig));
    } catch (e) { setErr(e instanceof Error ? e.message : "Sign failed"); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ padding: 20 }}>
      <h2>Typed data signature</h2>
      <p style={{ opacity: 0.7, fontSize: 12 }}>{req.origin}</p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#16161c", padding: 12, borderRadius: 8, fontSize: 11, maxHeight: 220, overflow: "auto" }}>
        {JSON.stringify(req.typedData, null, 2)}
      </pre>
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
      <button disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700 }} onClick={sign}>
        {busy ? "Waiting for Windows Hello…" : "Sign with passkey"}
      </button>
      <button style={{ width: "100%", padding: 12, marginTop: 8, borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#fff" }} onClick={() => rejectApproval(req.id, "User rejected")}>Reject</button>
    </div>
  );
}
```

- [ ] **Step 2: Route it in `App.tsx`** — add:
```tsx
import { SignTypedSheet } from "./sheets/SignTypedSheet";
// ...
if (approval?.kind === "signTyped") return <SignTypedSheet req={approval} />;
```

- [ ] **Step 3: Build + manual test** — in the test dapp use "Sign Typed Data V4" → Trezo popup → sign → dapp shows signature.

- [ ] **Step 4: Commit**

```
git add apps/extension/src/popup
git commit -m "feat(extension): eth_signTypedData_v4 sheet"
```

---

## Milestone 6 — Gasless transaction

Outcome: a dApp's `eth_sendTransaction` becomes a sponsored UserOperation; the tx confirms on Base Sepolia.

### Task 6.1: Smart-account execution wrapper

**Files:**
- Create: `apps/extension/src/core/smartAccountExecution.ts`

- [ ] **Step 1: Write the wrapper** (prepare → sign-in-popup → submit → wait), reusing `userOps.ts`.

```ts
import type { Hex } from "viem";
import { buildSmartAccountExecutionUserOp, submitConfiguredUserOp, waitForUserOperationReceipt } from "./userOps";
import { EXTENSION_CONFIG } from "./config";
import type { PasskeySignature } from "../passkey/encode";
import { encodeSignatureForContract } from "../passkey/encode";

export type PreparedTx = {
  userOpHash: Hex;
  userOp: Record<string, unknown>;
};

export async function prepareDappTx(params: {
  account: `0x${string}`;
  passkeyIdRaw: Hex;
  to: `0x${string}`;
  value: bigint;
  data: Hex;
}): Promise<PreparedTx> {
  const { userOp, userOpHash } = await buildSmartAccountExecutionUserOp({
    chainId: EXTENSION_CONFIG.chainId,
    bundlerUrl: EXTENSION_CONFIG.bundlerUrl,
    smartAccountAddress: params.account,
    target: params.to,
    value: params.value,
    data: params.data,
    passkeyId: params.passkeyIdRaw,
    usePaymaster: true,
    paymasterUrl: EXTENSION_CONFIG.paymasterUrl,
    operationLabel: "dappSendTransaction",
  });
  return { userOp: userOp as unknown as Record<string, unknown>, userOpHash };
}

export async function submitDappTx(prepared: PreparedTx, signature: PasskeySignature): Promise<Hex> {
  const encoded = encodeSignatureForContract(signature);
  const signedUserOp = { ...prepared.userOp, signature: encoded };
  const submitted = await submitConfiguredUserOp(signedUserOp as never, EXTENSION_CONFIG.chainId, EXTENSION_CONFIG.bundlerUrl);
  return submitted as Hex;
}

export async function waitForTx(userOpHash: Hex) {
  return waitForUserOperationReceipt(userOpHash, EXTENSION_CONFIG.chainId, EXTENSION_CONFIG.bundlerUrl);
}
```

- [ ] **Step 2: Build / type-check**

Run from `D:\trezo`: `npm run -w apps/extension build`. Fix only type/import mismatches against the copied `userOps.ts` signatures.

- [ ] **Step 3: Commit**

```
git add apps/extension/src/core/smartAccountExecution.ts
git commit -m "feat(extension): smart-account execution wrapper (prepare/submit/wait, gasless)"
```

### Task 6.2: Tx confirm sheet (build → sign → submit in popup)

**Files:**
- Create: `apps/extension/src/popup/sheets/TxConfirmSheet.tsx`
- Modify: `apps/extension/src/popup/App.tsx`

- [ ] **Step 1: `TxConfirmSheet.tsx`**

```tsx
import { useState } from "react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { WebAuthnService } from "../../passkey/webauthnService";
import { WalletResolver } from "../../pairing/walletResolver";
import { prepareDappTx, submitDappTx } from "../../core/smartAccountExecution";
import { credentialIdToBytes32 } from "../../passkey/encode";

export function TxConfirmSheet({ req }: { req: { id: string; origin: string; tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` } } }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const wallet = await WalletResolver.get();
      const meta = await WebAuthnService.getStored();
      if (!wallet || !meta) throw new Error("Not paired");
      setStage("Building sponsored transaction…");
      const prepared = await prepareDappTx({
        account: wallet.address,
        passkeyIdRaw: meta.credentialIdRaw as `0x${string}`,
        to: req.tx.to,
        value: req.tx.value ? BigInt(req.tx.value) : 0n,
        data: (req.tx.data ?? "0x") as `0x${string}`,
      });
      setStage("Waiting for Windows Hello…");
      const sig = await WebAuthnService.sign(prepared.userOpHash);
      setStage("Submitting…");
      const hash = await submitDappTx(prepared, sig);
      await resolveApproval(req.id, hash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transaction failed");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Confirm transaction</h2>
      <p style={{ opacity: 0.7, fontSize: 12 }}>{req.origin}</p>
      <div style={{ background: "#16161c", padding: 12, borderRadius: 8, fontSize: 12 }}>
        <div>To: <code style={{ wordBreak: "break-all" }}>{req.tx.to}</code></div>
        <div>Value: {req.tx.value ? BigInt(req.tx.value).toString() : "0"} wei</div>
        <div>Data: <code style={{ wordBreak: "break-all" }}>{(req.tx.data ?? "0x").slice(0, 42)}…</code></div>
        <div style={{ marginTop: 6, color: "#7ee787" }}>Gas sponsored (gasless)</div>
      </div>
      {stage && <p style={{ opacity: 0.8 }}>{stage}</p>}
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
      <button disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#6d5efa", color: "#fff", fontWeight: 700 }} onClick={confirm}>
        {busy ? "Working…" : "Confirm & send"}
      </button>
      <button style={{ width: "100%", padding: 12, marginTop: 8, borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#fff" }} onClick={() => rejectApproval(req.id, "User rejected")}>Reject</button>
    </div>
  );
}
```

- [ ] **Step 2: Route it in `App.tsx`** — add:
```tsx
import { TxConfirmSheet } from "./sheets/TxConfirmSheet";
// ...
if (approval?.kind === "tx") return <TxConfirmSheet req={approval} />;
```

- [ ] **Step 3: Build + manual gasless-tx test**

1. Ensure your AA on Base Sepolia is deployed (it is, from mobile) and the Pimlico paymaster has balance (Task 6 risk 4).
2. Build + reload + ensure paired + connected to a dApp.
3. Trigger a transaction: easiest reliable path is the MetaMask test dapp "Send eth_sendTransaction" or an ERC-20 approve on a known Base Sepolia token. (For a real Uniswap moment: connect to Uniswap, start a swap, and approve the ERC-20 it requests — that approve is a real `eth_sendTransaction`.)
4. The Trezo popup shows the tx → "Confirm & send" → Windows Hello → "Submitting…".
5. Observe a returned userOp/tx hash in the dapp. Verify on `https://sepolia.basescan.org` that the tx confirmed, paid by the paymaster (your AA's ETH balance unchanged).

Expected: tx confirms gaslessly on Base Sepolia; the dapp receives a hash.

- [ ] **Step 4: Commit**

```
git add apps/extension/src/popup
git commit -m "feat(extension): gasless eth_sendTransaction confirm sheet (UserOp via Pimlico)"
```

### Task 6.3: Popup keep-alive across WebAuthn (risk 3)

**Files:**
- Modify: `apps/extension/src/popup/main.tsx`
- Modify: `apps/extension/src/background.ts`

- [ ] **Step 1: Open a long-lived port from the popup so the SW stays awake during the Hello round-trip**

In `main.tsx`, before rendering:
```ts
const port = chrome.runtime.connect({ name: "trezo-popup-keepalive" });
port.onDisconnect.addListener(() => {});
```

In `background.ts`, add:
```ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "trezo-popup-keepalive") {
    const ping = setInterval(() => { try { port.postMessage({ t: "ping" }); } catch { /* closed */ } }, 20_000);
    port.onDisconnect.addListener(() => clearInterval(ping));
  }
});
```

- [ ] **Step 2: Manual — confirm no "popup closed" failures**

Repeat the sign and tx flows; confirm Windows Hello never causes the popup to drop the request (no "Receiving end does not exist" errors). If the programmatic popup closes when Windows Hello grabs focus, switch the approval UI to `chrome.windows.create` (separate window) in `approvalManager.ts` — that window survives focus changes.

- [ ] **Step 3: Commit**

```
git add apps/extension/src/popup/main.tsx apps/extension/src/background.ts
git commit -m "fix(extension): keep service worker alive across WebAuthn round-trip"
```

---

## Milestone 7 — Polish, error states, demo dry-run

### Task 7.1: accountsChanged / chainChanged events + disconnect

**Files:**
- Modify: `apps/extension/src/background.ts`, `apps/extension/src/popup/screens/HomeScreen.tsx`

- [ ] **Step 1: Emit events to connected tabs when a session changes** — add a helper in `background.ts`:
```ts
async function emitToOrigin(origin: string, event: string, data: unknown) {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  for (const t of tabs) if (t.id) chrome.tabs.sendMessage(t.id, { type: "trezo-event", event, data }).catch(() => {});
}
```
Call `emitToOrigin(origin, "accountsChanged", [address])` after a successful connect, and `emitToOrigin(origin, "accountsChanged", [])` on disconnect.

- [ ] **Step 2: Add a "Disconnect all" button on Home** that clears sessions:
```tsx
import { sessionStore } from "../../rpc/sessionStore";
// button onClick:
async () => { await chrome.storage.local.remove("trezo_sessions_v1"); }
```

- [ ] **Step 3: Manual test** — connect, then disconnect; dapp sees `accountsChanged []`.

- [ ] **Step 4: Commit**

```
git add apps/extension/src
git commit -m "feat(extension): provider events + disconnect"
```

### Task 7.2: README + demo script

**Files:**
- Create: `apps/extension/README.md`

- [ ] **Step 1: Write build/load/demo instructions** covering: env setup (`.env.local`), `npm run -w apps/extension build`, load unpacked, Chrome ≥122 note, the DevTools virtual-authenticator tip, the pairing steps, and the exact viva demo script (open Uniswap → Trezo in EIP-6963 → connect → sign → gasless approve).

```md
# Trezo Chrome Extension

## Setup
1. Copy `.env.example` to `.env.local`, fill Pimlico + Supabase values (from apps/mobile/.env).
2. From repo root: `npm run -w apps/extension build`.
3. chrome://extensions → Developer mode → Load unpacked → `apps/extension/dist`.
4. Requires Chrome ≥ 122.

## Pair (one-time)
- Phone: Profile → Devices → Pair New Device. Read `requestId` + `secret` from the QR link.
- Extension popup: sign in → paste `requestId:secret` → Pair → Windows Hello.
- Phone: approve. Extension now shows the same smart-account address.

## Testing without biometric hardware
DevTools → (⋮) → More tools → WebAuthn → Enable → Add virtual authenticator (ctap2, internal, resident keys ON, user verification ON).

## Demo
Open Uniswap → wallet list shows Trezo → Connect → AA address → Personal Sign (Windows Hello) → start a swap → approve the ERC-20 (gasless on Base Sepolia).
```

- [ ] **Step 2: Commit**

```
git add apps/extension/README.md
git commit -m "docs(extension): build, pairing, and demo instructions"
```

### Task 7.3: Full demo dry-run (manual acceptance)

- [ ] **Step 1: End-to-end acceptance checklist** — run all and confirm:
  1. Fresh Chrome profile, load unpacked, Chrome ≥122.
  2. Login (email) → pair (phone approves once) → Home shows same AA address as phone.
  3. Uniswap (or test dapp): Trezo appears in EIP-6963 list → connect → AA address shown.
  4. personal_sign → Windows Hello → signature; `isValidSignature` returns `0x1626ba7e`.
  5. eth_signTypedData_v4 → signature.
  6. eth_sendTransaction (ERC-20 approve) → Windows Hello → confirms gaslessly on Basescan.
  7. Disconnect → dapp sees `accountsChanged []`.
  8. Close + reopen Chrome → session/pairing persists (no re-pair).

- [ ] **Step 2: Record results** in `docs/plans/2026-05-31-chrome-extension-acceptance.md` (pass/fail per item with Basescan tx link). Commit it.

---

## Post-implementation

- [ ] **Log the architecture decision** (copy-and-adapt core now, extract `packages/wallet-core` later) via the `log-decision` skill → `docs/decisions/0014-extension-core-copy-and-adapt.md`.
- [ ] **Finish the branch** via `superpowers:finishing-a-development-branch` (PR to `feat/mobile-polish-pass` or `main`).

---

## Plan self-review notes

- **Spec coverage:** §1 scope → Milestones 1–6; §3 architecture (4 contexts + WebAuthn-in-popup) → Tasks 1.2–1.4, 5.1, 6.3; §4 account model → Milestone 4; §5 reuse strategy → Tasks 2.x, 3.1, 4.2; §6 RPC surface → Task 5.2; §7 gasless+1271 → Tasks 5.3, 6.x; §8 security → manifest host_permissions (0.3), session-only approval queue (5.1), platform authenticator (3.3); §9 demo → Tasks 6.2, 7.2–7.3; §10 risks → Tasks 5.3 (1271), 6.3 (popup lifecycle), 2.2 (paymaster env), 4.x (pairing). All spec sections map to tasks.
- **Type consistency:** `PasskeySignature`, `PasskeyMetadata`, `parseWebAuthnAssertion`, `encodeSignatureForContract`, `credentialIdToBytes32`, `EXTENSION_CONFIG`, `WalletResolver`, `sessionStore`, `handleRpc`, `requestApproval`/`resolveApproval`/`rejectApproval`, `prepareDappTx`/`submitDappTx`/`waitForTx` are defined once and reused with matching signatures.
- **Known executor caveats flagged inline:** (a) verify Base Sepolia deployment addresses vs mobile; (b) verify `aa_wallets` table/columns; (c) clean up the redundant `allowCredentials` ternary in 3.3; (d) EIP-1271 envelope may need a validator prefix; (e) Google OAuth optional, email is the demoable path.
