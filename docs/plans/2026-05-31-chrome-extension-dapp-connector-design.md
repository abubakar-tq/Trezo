# Trezo Chrome Extension (MV3) — dApp Connector Design

- **Date:** 2026-05-31
- **Status:** Approved (brainstorming complete) — ready for implementation plan
- **Branch / worktree:** `feat/chrome-extension` at `.claude/worktrees/chrome-extension`
- **Requirement traceability:** FR-10 ("Chrome extension"), TC-10 ("Test extension injects Web3 provider into browser"), NFR-08 ("responsive on desktop and Chrome extension views"). Source: Supervisor.

---

## 1. Goal & scope

Ship an MV3 Chrome extension that is a **paired device on the user's existing Trezo ERC-4337 smart account** and acts as an EIP-1193 / EIP-6963 wallet for real dApps.

FR-10/TC-10 only require that the extension *inject a Web3 provider*. We deliberately go further (user-approved "Full" scope):

1. **Login** — Supabase email / Google OAuth (identifies the user, finds their wallet).
2. **Pair** — register the extension's own passkey onto the user's existing smart account via the existing device-pairing flow (`addPasskey`), authorized once by the phone. Same smart-account **address** as the phone.
3. **Connect** — dApps discover "Trezo" via EIP-6963; `eth_requestAccounts` returns the AA address.
4. **Sign** — `personal_sign` / `eth_signTypedData_v4` via Windows Hello, verifiable on-chain through `SmartAccount.isValidSignature` (EIP-1271).
5. **Transact** — `eth_sendTransaction` → UserOperation → Pimlico paymaster → **gasless** on Base Sepolia.

**Demo network:** Base Sepolia (84532). The architecture is multi-chain but v1 targets Base Sepolia (the chain with funded Pimlico bundler/paymaster and ZK-email parity).

## 2. Non-goals (YAGNI for v1)

- Swaps / bridges / recovery *initiated from* the extension.
- A fully-completing Uniswap **swap** (needs Base Sepolia pool liquidity; see §9).
- Chains beyond Base Sepolia (and any already-enabled testnets that work for free).
- Chrome Web Store publishing / store review.
- Cross-device sync of the extension popup session.
- Extracting a shared `packages/wallet-core` (deferred refactor; see §5).

## 3. Architecture — four contexts

MV3 splits the extension into contexts. One browser security rule drives the whole design.

```
┌─ inpage.ts  (page MAIN world) ───── EIP-1193 + EIP-6963 provider
│      window.postMessage  ▲│▼
├─ content.ts (isolated world) ─────── relay only (page ↔ background)
│      chrome.runtime.sendMessage ▲│▼
├─ background.ts (service worker) ───── rpcRouter + AA core + Supabase + Pimlico HTTP
│      opens popup for any user-gesture / biometric action ▲│▼
└─ popup (React) ───────────────────── login · pairing · connect/sign/tx approval · Windows Hello
```

### 3.1 The critical MV3 constraint (WebAuthn-in-popup)

A **service worker cannot call `navigator.credentials`** — it has no DOM and no user gesture, and browsers refuse to raise a biometric prompt from hidden background code. Therefore **every WebAuthn ceremony (create + get) runs in the popup (or an extension page/offscreen document), never in the background.**

Canonical request flow for any signature or transaction:

```
dApp → inpage → content → background (rpcRouter)
   → background opens the Trezo approval popup
   → user clicks "Approve" → navigator.credentials.get() → Windows Hello
   → popup returns the signature to background
   → background assembles + submits the UserOperation (or returns the signature)
```

From the user's perspective this is an ordinary approval popup + biometric — no extra steps, no phone. The only engineering care required: the popup must stay alive across the Windows Hello round-trip (keep-alive port, or an offscreen document). See §10 risk 3.

### 3.2 Context responsibilities

| Context | Responsibility | Key constraint |
|---|---|---|
| `inpage.ts` | Inject `window.ethereum` (legacy) + EIP-6963 announce; marshal requests as `postMessage` | ES5-safe, self-contained (ported from `injectedProvider.template.ts`) |
| `content.ts` | Bidirectional relay between page `postMessage` and `chrome.runtime` | No business logic |
| `background.ts` | Host the RPC router, AA core, Supabase client, bundler/paymaster HTTP; per-origin session store; open popup for approvals | No `navigator.credentials`; may be killed/restarted anytime → all state in `chrome.storage` |
| `popup` (React) | Login, pairing wizard, connect/sign/tx approval sheets; run WebAuthn | Holds the only DOM + user gesture |

## 4. Account model — paired device on the existing AA

The extension is **a new device on the user's real smart account**, not a fresh wallet. It plays the "new device" role of the existing `DevicePairingService` + `PairDeviceScreen` flow.

```
PHONE (trusted device)                         EXTENSION (new device)
──────────────────────                         ──────────────────────
"Pair New Device"
 createPairingRequest()
  → 32-byte secret; SHA-256 hash → Supabase
  → QR / short code  ───────────────────────▶  log in (Supabase email/Google)
                                                enter code → getPairingRequestForUser()
                                                Windows Hello → navigator.credentials.create()
                                                  (NEW passkey; RP = abubakar-tq.github.io)
                                                submitNewDevicePasskey(px, py, credId)
                          ◀───────────────────  status = "passkey_submitted"
 sees pending approval
 phone passkey signs buildAddPasskeyUserOp(px,py)
  → gasless addPasskey on-chain (same account)
  → markApprovedAfterReceipt() ─────────────▶  polls → status = "approved"
                                                WalletSyncService.hydrateWalletForUser()
                                                ✅ SAME AA address; OWN local passkey
```

**Pair once, then never again.** After pairing, the extension signs with its **own** Windows Hello passkey (registered on-chain on the same account). The phone is involved **only** during the one-time pairing approval. Day-to-day transacting needs only the laptop.

**Security separation:** email/password merely *identifies* the user (Supabase auth) and lets the extension join the pairing request. Authority to add the key is the **on-chain `addPasskey`, signed by the phone's existing passkey.** A stolen password alone cannot add a rogue device.

## 5. Core reuse strategy (the structural decision)

The mobile AA/passkey/pairing logic is reusable but **RN-coupled at the config layer**: `networks.ts` imports `expo-constants` + `react-native`, and `userOps.ts → clients.ts → networks.ts` transitively drags that in. To avoid destabilizing the mobile app before the viva, **v1 copies-and-adapts the core into `apps/extension/src/core/`** rather than extracting a shared workspace package.

| Action | Modules | Notes |
|---|---|---|
| **Copy ~verbatim** (pure logic) | `userOps.ts`, `revertDecoding.ts`, passkey **encode** functions (`parseWebAuthnSignature`, `parseDERSignature` w/ low-s, `encodeSignatureForContract`, COSE/SPKI parsing), ABI JSON, deployment-address JSON | Replace `__DEV__` with a build const; no RN imports remain |
| **Adapt** (drop RN, browser-native config) | `clients.ts` (explicit chain + RPC, no `networks.ts` import), a new thin `config.ts` (Base Sepolia: RPC, Pimlico bundler URL, Pimlico paymaster URL, deployment addresses) sourced from Vite env | One chain in v1 |
| **Rewrite for browser** | `PasskeyService` *ceremony* → `navigator.credentials` + `chrome.storage`; `DevicePairingService` → `chrome.storage` + Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`); provider/content/background transport; popup UI; Supabase auth | Keep the encode logic from `PasskeyService` |

**Tradeoff:** duplication that may drift from mobile. Accepted for v1; a follow-up can extract `packages/wallet-core` shared by both apps. **This is ADR-worthy** — log a decision record (copy-and-adapt now, extract later).

`@supabase/supabase-js` and `viem` are isomorphic and already used by `guardian-approval`; they run in the service worker and popup unchanged.

## 6. dApp RPC surface

Ported from `apps/mobile/src/features/browser/web/rpcRouter.ts` (same method set and error codes):

- `eth_requestAccounts` — return AA address; if no session, open popup for per-origin connect approval.
- `eth_accounts` — session address or `[]`.
- `eth_chainId` — session chain or default (Base Sepolia).
- `personal_sign` — passkey sign via popup; return EIP-1271-verifiable signature.
- `eth_signTypedData_v4` — same, typed data.
- `eth_sendTransaction` — `{to,data,value}` → UserOp → Pimlico → submit; return tx/userOp hash (per ADR-0002, dApp `eth_sendTransaction` returns the userOpHash).
- `wallet_switchEthereumChain` — v1 supports Base Sepolia; reject others with `4902`.

Per-origin sessions persisted in `chrome.storage.local` (origin → {address, chainId, approvedAt}). Standard JSON-RPC error codes: `4001` user rejected, `4100` unauthorized, `4902` unrecognized chain, `-32601` unsupported method, `-32603` internal.

## 7. Gasless transaction + EIP-1271 signing

- **Transaction:** `eth_sendTransaction {to,data,value}` → `buildSmartAccountExecutionUserOp` (wraps `SmartAccount.execute(to,value,data)`) → `pm_sponsorUserOperation` (Pimlico) → `eth_sendUserOperation` → poll `eth_getUserOperationReceipt`. Signature produced by the popup passkey ceremony. Gasless on Base Sepolia.
- **Signing (EIP-1271):** `SmartAccount.isValidSignature(bytes32,bytes)` exists (`contracts/src/account/SmartAccount.sol:221`, routes via `_routeIsValidSignature`). The extension returns a passkey signature encoded so this routes to the PasskeyValidator. The **exact 1271 envelope** is a build-time detail to confirm against `_routeIsValidSignature` (see §10 risk 2).

## 8. Security model (report-ready)

- **Key custody = Windows Hello / TPM** — identical model to mobile's secure enclave. With `authenticatorAttachment: 'platform'` + `userVerification: 'required'`, the P-256 private key is generated inside the TPM, is non-exportable, and the extension only ever receives the public key + per-signature outputs.
- **No exportable secret in the browser at all** — strictly safer than seed-phrase extension wallets (no encrypted seed in storage to target). Every signature requires a live Windows Hello gesture.
- **`chrome.storage.local` holds only public metadata** (credentialId, public key x/y, rpId, device label, per-origin sessions). The pairing secret lives only in memory; only its SHA-256 hash reaches the server.
- **Device addition is authorized on-chain by the phone** — compromising the extension (or the password) alone cannot add a key.
- **Per-origin connect approval**; **`host_permissions`** scoped to the RP domain (`https://abubakar-tq.github.io/*`, enabling the extension's WebAuthn RP ID per Chrome ≥122) plus dApp origins; human-readable approval sheets reuse the FR-14/15 confirm-sheet pattern where practical.
- **Provider attack surface:** content script injects into pages; mitigations are explicit per-origin approval, per-action user verification, and showing exactly what is being signed.

WebAuthn-in-extension mechanism confirmed: Chrome ≥122 lets an extension set RP ID to a domain in its `host_permissions` with **no `.well-known` file required**; `clientDataJSON.origin` becomes `chrome-extension://<id>` but on-chain validation verifies the P-256 signature, not the origin. Because the RP ID is the **domain** (not the volatile extension ID), the derived AA address is stable across dev/publish.

## 9. Demo plan + honest Uniswap caveat

- ✅ **Robust path:** open real Uniswap → it lists **Trezo** (EIP-6963) → connect → shows the AA address → it requests an ERC-20 **approve** → execute that approve **gaslessly via Windows Hello**. A genuine transaction from a genuine dApp on Base Sepolia.
- ⚠️ **A completing Uniswap swap is fragile on Base Sepolia** — `networks.ts:77` gates `swapSupported` behind a pool-liquidity healthcheck, and only the base-mainnet-fork has working Uniswap. Pools are usually dry; the swap would revert for lack of liquidity, not because of Trezo.
- **Recommendation:** demo the real `approve` plus a controlled fallback action (self-transfer or a known mint that lands on Base Sepolia). A fully seeded-pool swap is out of scope for v1.

## 10. Risks & early verifications

1. **Chrome ≥ 122** required for extension WebAuthn custom RP ID. (Fine on the dev machine; note in report.)
2. **Exact EIP-1271 envelope** for `isValidSignature` — verify against `_routeIsValidSignature` in implementation step 1; write a tiny on-chain read test before relying on dApp message verification.
3. **Popup lifecycle across the Windows Hello round-trip** — popup may close; prototype keep-alive (long-lived port) or an offscreen document **early** (first sign milestone).
4. **Pimlico paymaster funded on Base Sepolia** — confirm `EXPO_PUBLIC_BASE_SEPOLIA_*` (bundler/paymaster) env values and balance before the tx milestone.
5. **Phone-side approval already builds `addPasskey`** — confirm `DevicesPasskeysScreen` / pending-approvals path signs and submits `buildAddPasskeyUserOp` end-to-end (assumed complete; verify during pairing milestone).
6. **`react-native-passkeys` vs browser WebAuthn response shapes** — the encode logic expects base64url `authenticatorData`/`clientDataJSON`/`signature`; browser `AuthenticatorAssertionResponse` returns ArrayBuffers. Adapter must convert ArrayBuffer → base64url before reusing `parseWebAuthnSignature`.

## 11. Toolchain & repository layout

New workspace `apps/extension/` — Vite 8 + React 19 + viem 2 + `@supabase/supabase-js` + Tailwind 3 (matching `apps/guardian-approval`) **plus `@crxjs/vite-plugin`** for MV3 bundling.

```
apps/extension/
  manifest.json                 # MV3: permissions, host_permissions, action(popup), background(sw), content_scripts
  vite.config.ts                # @crxjs/vite-plugin + @vitejs/plugin-react
  package.json                  # workspace member
  src/
    inpage.ts                   # EIP-1193 + EIP-6963 provider (from injectedProvider.template.ts)
    content.ts                  # page ↔ background relay
    background.ts               # service worker: rpcRouter + AA core wiring + session store
    rpc/rpcRouter.ts            # ported router (popup-bridged approvals)
    core/                       # copied/adapted AA core
      config.ts                 # Base Sepolia: rpc, bundler, paymaster, deployment addresses
      clients.ts                # browser viem clients
      userOps.ts                # copied
      revertDecoding.ts         # copied
      abis.ts, deployments.json # copied data
    passkey/
      webauthnService.ts        # navigator.credentials create/get + chrome.storage
      encode.ts                 # parseWebAuthnSignature/parseDERSignature/encodeSignatureForContract (copied)
    pairing/
      devicePairingService.ts   # chrome.storage + Web Crypto port of DevicePairingService
    auth/supabase.ts            # Supabase client + email/Google auth
    popup/                      # React: Login, PairDevice, ConnectSheet, SignSheet, TxConfirmSheet
```

Add `apps/extension` to root `package.json` workspaces. Per project convention, **do not run `npm install` inside the worktree** (deps resolve up to root `node_modules`); add the few new deps (`@crxjs/vite-plugin`) at the appropriate level during setup.

## 12. Resolved decisions

- **Account model:** paired device on existing AA (same address), not a fresh wallet and not phone-tethered-per-signature. ✔
- **v1 scope:** Full — pair + connect + sign + gasless tx. ✔
- **Core reuse:** copy-and-adapt into `apps/extension/src/core` for v1; shared package deferred. ✔ (ADR to be logged)
- **Demo tx target:** real dApp `approve` (gasless) + controlled fallback; no seeded-pool swap in v1. ✔
