# Trezo

A passkey-first ERC-4337 smart-contract wallet (React Native / Expo). This file is the project's shared vocabulary — terms below have specific meanings here that may differ from how the broader crypto industry uses them.

## Language

### Account states

**Unprovisioned**:
A user with no passkey credential bound to their account yet; the smart-account address is not knowable.
_Avoid_: "no wallet", "fresh user"

**Provisioned**:
A user whose passkey credential exists and whose smart-account address has been predicted via `AccountFactory.predict*`, but whose contract is not deployed on any chain yet.
_Avoid_: "set up", "ready"

**Active on chain X**:
The smart-account contract is deployed on chain X and the `PasskeyValidator` module is installed. Activation is **per-chain** — a user can be Active on Sepolia and not on Base Sepolia.
_Avoid_: "deployed" (ambiguous on which chain), "activated wallet" (chain-agnostic phrasing)

**Activation sheet**:
A bottom-sheet UI that appears when the user attempts a Send / Swap / Buy on a chain where their account is not Active. Runs the passkey ceremony (if Unprovisioned) and the deploy UserOp, then returns the user to their original action.
_Avoid_: "deploy modal", "create-wallet popup"

### Devices and pairing

**Linked Device**:
A device that holds a passkey credential authorised to sign for this user's smart account. The list of Linked Devices is managed from the Profile.
_Avoid_: "registered device", "trusted device", "device with passkey"

**Device pairing**:
The handshake that registers a new device's passkey against an existing user account, initiated from an already-trusted device.
_Avoid_: "passkey linking", "device sync"

**Pairing link**:
The `trezo://pair-device?...` deep link, encoded in a QR on the trusted device, that authorises a new device to begin pairing.
_Avoid_: "QR link", "device-add link"

### Browser and dApps

**Discover tab**:
The bottom-tab surface that hosts the discover home (trending tokens, news, sites), the unified search bar (sites + tokens + URLs), and the multi-tab WebView. Replaces the previous "Browser" tab.
_Avoid_: "browser tab", "search tab"

**Connected dApp**:
A dApp with an active session against the user's wallet. v1 sessions are in-app injected-provider sessions only; Phase 2 will add WalletConnect v2 sessions to the same list.
_Avoid_: "authorised site", "linked app"

### Data scope

**Mainnet read-only data**:
Token prices, market trends, news, and discovery content sourced from mainnet (CoinGecko / Moralis / RSS feeds). Informational only — never used as a chain target for transactions.
_Avoid_: "market data" (when ambiguous), "token data"

**Testnet wallet ops**:
On-chain operations (send, receive, swap, buy, deploy, sign) targeting Sepolia (11155111), Base Sepolia (84532), Arbitrum Sepolia (421614), and Anvil (31337). The only chains the wallet transacts on during the testnet-demo phase.
_Avoid_: "supported chains" (when ambiguous with read-only data)

### Swap and cross-chain

**Same-chain swap**:
A swap action where source and destination tokens live on the same chain (e.g. USDC → ETH on Base Sepolia). Routes through external DEX liquidity (Uniswap V3) using the addresses pinned per chain in `dexRegistry.ts`. Per-chain support is gated by a `swapSupported` flag on `NetworkConfig`, flipped by the swap-pool healthcheck. The Swap action in the UI maps to this when source and destination chain are equal.
_Avoid_: "swap" (when ambiguous with cross-chain swap)

**Cross-chain swap**:
A single signed action that moves value from chain A to chain B, optionally changing the token in the process (e.g. USDC on Sepolia → ETH on Arbitrum Sepolia). Implemented by depositing into the Across V3 SpokePool on the source chain with a `message` payload, then having the **CrossChainExecutor** on the destination chain swap the bridged token via Uniswap V3 before forwarding to the user's smart account. Per-chain support is gated by a `crossChainSwapSupported` flag on `NetworkConfig`.
_Avoid_: "bridge swap", "multi-chain swap"

**CrossChainExecutor**:
A deterministic Trezo module deployed via Safe Singleton Factory on every chain in **Testnet wallet ops** at the same address. Receives Across bridge proceeds (USDC, WETH), decodes the embedded `message`, swaps the bridged token through the destination's Uniswap V3 router to the user's chosen `buyToken`, and forwards the output to the user's smart account. Falls back to forwarding the raw bridged token if the destination-side swap fails.
_Avoid_: "swap helper", "bridge handler", "destination contract"

**Across relayer (self-hosted)**:
A Trezo-operated instance of the upstream `across-protocol/relayer` Docker image, run **on-demand** during testnet demo windows to win the permissionless filler race against the Across community testnet relayer. Brings testnet bridge latency from minutes to ~30 seconds. Funded with a small float of testnet WETH/USDC on each chain. Lifecycle: `make relayer-up` / `make relayer-down`. Not run in production — mainnet Across relayer market is competitive and Trezo is not a filler.
_Avoid_: "Across server", "bridge backend"

### Recovery

**Wallet compromise (action)**:
A high-impact, destructive flow surfaced as a top-level Profile action (styled like Sign Out). Tapping it navigates to a screen that walks the user through Guardian Recovery or Email Recovery to lock out compromised credentials.
_Avoid_: "panic button", "lock wallet"

## Relationships

- A **user** moves through states in order: Unprovisioned → Provisioned → Active on chain X.
- Activation is per-chain; a user who is Active on Sepolia but not on Base Sepolia hits the **Activation sheet** when they tap Send/Swap/Buy on Base Sepolia.
- **Receive** requires only Provisioned state — counterfactual addresses receive natively.
- A **Linked Device** is tied to a passkey credential, which in turn is bound to the user's smart account address; therefore each Linked Device added must consume a valid **Pairing link** from an already-Linked Device.
- The **Discover tab**'s discovery content uses **Mainnet read-only data**; any Buy/Swap/Send action launched from a token surface routes through **Testnet wallet ops**. The two surfaces are intentionally disjoint and never reveal the split as user-visible chrome.
- A **Connected dApp** is bound to a specific Linked Device's session; disconnecting from Profile terminates the session for that device only (Phase 2 will broaden this for WalletConnect cross-device sessions).
- A **Cross-chain swap** requires the user to be **Active on chain X** for *both* the source and destination chain — the source side needs a deployed smart account to sign the deposit, and the destination side needs a deployed smart account to receive the output. The **Activation sheet** handles missing activation on either chain before the cross-chain UserOp is built.
- **Same-chain swap** support per chain is determined at runtime by a swap-pool healthcheck against the Uniswap V3 pools pinned in `dexRegistry.ts`. The **CrossChainExecutor** depends on the destination chain's `swapSupported` being true for swap-on-arrival to work; falls back to forwarding the bridged token when false.

## Example dialogue

> **Dev:** "If a user is **Provisioned** but not **Active on Sepolia**, can they Receive USDC on Sepolia?"
> **Domain expert:** "Yes. Receive only requires **Provisioned** because the counterfactual address can hold ERC-20 transfers. The contract bytecode isn't needed until they try to Send or Swap."
>
> **Dev:** "And the **Activation sheet** — does it always run a passkey ceremony?"
> **Domain expert:** "Only if the user is **Unprovisioned**. If they're already **Provisioned**, the sheet just runs the deploy UserOp on the requested chain — the existing passkey signs."

## Flagged ambiguities

- "Passkey linking" (informal) was used in the original mobile-polish brief to mean **Device pairing**. Resolved: use *Device pairing* in code/specs; *Linked Devices* is the user-facing surface label.
- "Browser" (current tab name) does not describe the post-redesign surface — that surface is curation-first plus search plus WebView. Resolved: rename to **Discover tab**.
- "Active account" was used loosely in the original brief to mean both *Provisioned* and *Active on chain X*. Resolved: these are now distinct states; the **Activation sheet** handles the transition between them.
- "Buy" vs "Sell" on token detail was a category error (fiat-onramp vs crypto-swap). Resolved: token detail uses **Send / Receive / Swap** only; fiat **Buy** lives as a global Home action.
- "Sponsored gas" was originally defined (App-improvements-brief.md Rule 2) as deploy-only sponsorship on all chains. Resolved per ADR-0001: **on testnets, all UserOps are sponsored by the Pimlico paymaster** (deploy + sends + swaps + dApp signing). The brief's deploy-only rule applies to **mainnet** only and will be enforced when mainnet rollout begins.
- In-app dApp signing assumes **EIP-1271 compatibility**: dApps must verify signatures by calling `isValidSignature(hash, sig)` on the smart-account address (not by `ecrecover` on raw bytes). Modern dApps (Uniswap, Aave, OpenSea, Safe-aware apps) support this; older ones may not. Trezo does not ship a legacy `ecrecover` fallback — dApp incompatibility is a dApp-side issue.
- `eth_sendTransaction` returns a **UserOp hash**, not an Ethereum tx hash. See ADR-0002. Modern ERC-4337-aware dApps resolve confirmation via `eth_getUserOperationReceipt`.
