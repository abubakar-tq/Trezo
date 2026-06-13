# In-app dApp Session Model (v1)

## Session

A **Session** is a per-(dApp origin, Linked Device) record:

| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | local |
| origin | string | dApp origin URL (scheme + host) |
| accountAddress | `0x{string}` | the smart-account address authorised |
| chainId | number | the chain the dApp last requested |
| approvedAt | ISO8601 | first approval |
| lastUsedAt | ISO8601 | last successful method call |

Stored in AsyncStorage under key `trezo_dapp_sessions_v1` (Connected dApps storage decision: local-only for v1; Phase 2 migrates to Supabase).

## Permission model (v1)

- A single permission scope: **"sign + send for this account on any chain Trezo supports"**.
- Approval is per-origin, granted on first `eth_requestAccounts`.
- No expiry in v1 — sessions persist until manually disconnected from Profile.
- Disconnect removes the row from AsyncStorage and emits a `provider:disconnect` event to the WebView (the injected provider then ignores subsequent calls until re-approved).

## RPC methods (v1)

| Method | Behaviour |
|---|---|
| `eth_requestAccounts` | If no session exists, show approval sheet. Approve → write session, return [address]. Deny → return error code 4001. |
| `eth_accounts` | If session exists → [address]. Else []. No prompt. |
| `eth_chainId` | Returns the chainId from session (or active chain if no session). |
| `personal_sign` | Show signing sheet showing the message (hex-decoded if utf-8). Approve → passkey + sign via existing pipeline → return signature. |
| `eth_signTypedData_v4` | Show typed-data sheet with structured display (domain/type/message). Approve → passkey + sign → return signature. |
| `eth_sendTransaction` | Show send sheet (to, value, calldata decoded if possible). Approve → wrap into UserOp via `apps/mobile/src/integration/viem/userOps.ts` → passkey-sign → submit to bundler → return UserOp hash. |
| `wallet_switchEthereumChain` | If requested chain is in `getEnabledChains()` and account is Active there → update session chain, return null. Else return error 4902 ("unrecognized chain"). |
| `wallet_addEthereumChain` | Return error 4902 in v1 — Trezo's chain list is the canonical set. |

## Out of scope (v1)

- Per-method permission granularity.
- Session expiry / renewal.
- Multi-account selection at session creation time (always uses the active wallet).
- Cross-Linked-Device session propagation (sessions are device-local — explicit in CONTEXT.md).

## Phase 2 (forward-compatible)

- WalletConnect v2 sessions go into the **same** Connected dApps list with a `transport: "wc-v2" | "injected"` discriminator on each row.
- The Disconnect action stays semantically identical (kill local session; WC2 also sends a session_delete to the relay).
- Storage moves from AsyncStorage to a `dapp_sessions` table in Supabase, keyed by `(user_id, device_id, origin)`.
