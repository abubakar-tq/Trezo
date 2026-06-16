# Trezo Chrome Extension

A MV3 Chrome extension that pairs as a new linked device on an existing Trezo smart account
and lets dApps connect, sign (Windows Hello / passkey), and submit gasless transactions on
the active chain via ERC-4337 UserOperations sponsored by Pimlico.

---

## Prerequisites

- **Chrome ≥ 122** (required for extension WebAuthn with a custom RP ID).
  Check your version at `chrome://version`.
- A Trezo account already set up on the mobile app (the phone approves the one-time device pairing).
- Pimlico API key and Supabase project — values live in `apps/mobile/.env`.

---

## Environment setup

```sh
cp apps/extension/.env.example apps/extension/.env.local
```

Open `.env.local` and fill in the values from `apps/mobile/.env`:

| Extension variable | Mobile variable |
|--------------------|-----------------|
| `VITE_BASE_SEPOLIA_RPC_URL` | `EXPO_PUBLIC_BASE_SEPOLIA_RPC_URL` |
| `VITE_BASE_SEPOLIA_BUNDLER_URL` | `EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL` |
| `VITE_BASE_SEPOLIA_PAYMASTER_URL` | `EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL` |
| `VITE_SEPOLIA_RPC_URL` | `EXPO_PUBLIC_SEPOLIA_RPC_URL` |
| `VITE_SEPOLIA_BUNDLER_URL` | `EXPO_PUBLIC_SEPOLIA_BUNDLER_URL` |
| `VITE_SEPOLIA_PAYMASTER_URL` | `EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL` |
| `VITE_PASSKEY_RP_ID` | `EXPO_PUBLIC_PASSKEY_RP_ID` |
| `VITE_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

`.env.local` is gitignored.

---

## Build

From the **worktree root** (`D:\trezo\.claude\worktrees\chrome-extension`):

```sh
npm run -w apps/extension build
```

Output goes to `apps/extension/dist`.

---

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (toggle, top-right).
3. Click **Load unpacked** and select the `apps/extension/dist` folder.
4. A "Trezo" card appears with no errors.

To reload after a rebuild: click the refresh icon on the Trezo card (or use the
[Extensions Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) extension for one-click reloads).

---

## Multi-chain model

The extension is a **per-chain linked device**: each chain (Ethereum Sepolia, Base Sepolia)
has an independent smart-account address and a separate passkey registration.

- The **chain switcher** in the popup lets you change the active chain.
- When the active chain has no linked device you see **"Link this device on {chain}"**.
- Clicking that button navigates to the pairing screen for that chain.
- A dApp that calls `wallet_switchEthereumChain` updates the session's chain and the popup's
  active chain, emitting a `chainChanged` event to the page.

---

## Pairing (one-time per chain)

1. On your phone, **switch to the target chain** (e.g. Base Sepolia).
2. Go to **Profile → Devices → Pair New Device**.
3. Note the `requestId` and `secret` shown under the QR code (format: `requestId:secret`).
4. Open the extension popup → sign in with your Trezo email/password.
5. On the **Pair this extension** screen, paste `requestId:secret` and click **Pair device**.
6. Windows Hello prompts you to create a passkey — approve.
7. On the phone, approve the pending device request. The phone signs the on-chain
   `addPasskey` transaction.
8. The extension popup shows **"Paired!"** and then **Home** with the same smart-account
   address as the phone.

The phone is only needed for this one-time approval. After pairing all signing happens locally
via Windows Hello.

---

## Testing without biometric hardware

Use Chrome's built-in virtual authenticator:

1. Open DevTools (`F12`).
2. Click the `⋮` menu → **More tools → WebAuthn**.
3. Check **Enable virtual authenticator environment**.
4. Click **Add** with settings: transport = **Internal**, protocol = **ctap2**,
   **Supports resident keys** = ON, **Supports user verification** = ON.

The virtual authenticator will satisfy all passkey prompts without a fingerprint reader or
Windows Hello PIN.

---

## Demo script

1. Open a dApp — e.g. [MetaMask Test Dapp](https://metamask.github.io/test-dapp/) or Uniswap
   on Base Sepolia.
2. Click the wallet-connect button; Trezo appears in the **EIP-6963** provider list.
3. Select **Trezo** → the extension popup opens showing a **Connect** sheet.
4. Click **Connect** — the dApp shows your smart-account address.
5. Click **Personal Sign** (or initiate a Permit2 signature on Uniswap) → the popup shows a
   **Sign** sheet → click **Sign with passkey** → Windows Hello → signature returned.
6. To test `eth_signTypedData_v4`: use the test dapp's "Sign Typed Data V4" button.
7. To test a **gasless transaction**: initiate a token approve or a small swap on Uniswap →
   popup shows a **Confirm transaction** sheet → **Confirm & send** → Windows Hello →
   the UserOperation is submitted via Pimlico to the ERC-4337 bundler.

> **Important:** AA transactions do **not** appear under the account's top-level
> **Transactions** tab on Basescan/Etherscan. Look under **Internal Transactions** or verify
> on [Jiffyscan](https://jiffyscan.xyz) by searching for the UserOp hash returned by the dApp.

---

## Disconnect

Open the extension popup → Home → **Disconnect all dApps**.
This clears all stored dApp sessions and emits `accountsChanged []` to every connected tab so
dApps immediately reflect the disconnected state.
