# Chrome Extension — Acceptance Checklist

Run these checks in order on a real Chrome profile (≥ 122).  
Leave boxes unchecked; tick each one manually as you verify.

---

## Setup

- [ ] Chrome version is ≥ 122 (`chrome://version`).
- [ ] `apps/extension/.env.local` exists with valid Pimlico + Supabase values (from `apps/mobile/.env`).
- [ ] `npm run -w apps/extension build` completes with no errors from the worktree root.
- [ ] Extension loaded unpacked: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`.
- [ ] No error badge on the Trezo card; service worker shows "[trezo-bg] service worker booted" in its console.

---

## Authentication

- [ ] Clicking the extension icon opens the popup.
- [ ] Login screen appears (not a blank page or an error).
- [ ] Signing in with the Trezo email/password succeeds and navigates to the Pair or Home screen.

---

## Device pairing (per chain)

- [ ] Phone is on the target chain (e.g. Base Sepolia).
- [ ] Phone: Profile → Devices → Pair New Device shows a QR code and a `requestId:secret` string.
- [ ] Extension popup: Pair screen accepts the `requestId:secret` input.
- [ ] Windows Hello (or DevTools virtual authenticator) prompts for passkey creation.
- [ ] Phone: a pending device request appears and can be approved.
- [ ] After phone approval the extension popup shows "Paired!" then navigates to Home.
- [ ] Home shows the **same smart-account address** as the phone for that chain.
- [ ] Home shows **"Linked ✓"** next to the address after pairing on the active chain.

---

## Chain switcher

- [ ] Chain switcher in the popup lets you switch between enabled chains (Sepolia / Base Sepolia).
- [ ] Switching to a chain where the device is **not** yet linked shows the **"Link this device on {chain}"** button.
- [ ] Clicking that button navigates to the pairing screen with the correct chain hint.

---

## dApp connect (EIP-6963)

- [ ] Open the [MetaMask Test Dapp](https://metamask.github.io/test-dapp/) (or any EIP-6963-supporting dApp).
- [ ] **Trezo** appears in the provider/wallet list alongside other wallets.
- [ ] Selecting Trezo opens the extension popup with a **Connect** sheet showing the dApp origin.
- [ ] Clicking **Connect** returns the per-chain smart-account address to the dApp.
- [ ] `eth_accounts` on the dApp now returns that address.
- [ ] `eth_chainId` returns the hex chain ID matching the active chain.

---

## personal_sign

- [ ] dApp triggers `personal_sign`.
- [ ] Extension popup shows a **Sign** sheet with the message text and origin.
- [ ] Clicking **Sign with passkey** prompts Windows Hello (or virtual authenticator).
- [ ] A signature is returned to the dApp (hex string beginning with `0x`).
- [ ] (Optional, verifiable via the sign-sheet console log) `isValidSignature` on the smart contract returns `0x1626ba7e`.

---

## eth_signTypedData_v4

- [ ] dApp triggers `eth_signTypedData_v4` (test dapp: "Sign Typed Data V4").
- [ ] Extension popup shows a **Typed data signature** sheet with the JSON payload.
- [ ] Clicking **Sign with passkey** → Windows Hello → signature returned to dApp.

---

## Gasless eth_sendTransaction

- [ ] dApp triggers `eth_sendTransaction` (e.g. ERC-20 `approve`, or test dapp's send).
- [ ] Extension popup shows a **Confirm transaction** sheet with to/value/data and "Gas sponsored (gasless)".
- [ ] Clicking **Confirm & send** → Windows Hello → "Submitting…" → hash returned to dApp.
- [ ] Transaction confirmed on the active chain: verify via
  [Jiffyscan](https://jiffyscan.xyz) (search by UserOp hash) **or** via Basescan's
  **Internal Transactions** tab for the smart-account address.
  Basescan tx link (fill in after run): `_______________`
- [ ] Smart-account's native ETH balance is **unchanged** (gas was covered by the paymaster).

---

## wallet_switchEthereumChain

- [ ] dApp calls `wallet_switchEthereumChain` with a supported chain.
- [ ] Extension emits `chainChanged` to the dApp page with the new hex chain ID.
- [ ] Switching to a chain where the device **is not linked** (from the popup) shows the
  "Link this device on {chain}" prompt.

---

## Disconnect

- [ ] Extension popup → Home → **Disconnect all dApps** button is visible.
- [ ] Clicking it clears the session; the dApp's `accountsChanged` listener fires with `[]`.
- [ ] `eth_accounts` on the dApp now returns `[]`.
- [ ] Reconnecting works normally after disconnect.

---

## Session persistence

- [ ] Close Chrome completely and reopen.
- [ ] Extension popup shows the Home screen with the correct address (no re-login or re-pair required).
- [ ] A previously-connected dApp (before the browser restart) can still make RPC calls without
  reconnecting (session survives the restart).

---

## Reject flows

- [ ] Clicking **Reject** on the Connect sheet returns EIP-1193 error code 4001 to the dApp.
- [ ] Clicking **Reject** on the Sign sheet returns error code 4001.
- [ ] Clicking **Reject** on the Tx Confirm sheet returns error code 4001.
