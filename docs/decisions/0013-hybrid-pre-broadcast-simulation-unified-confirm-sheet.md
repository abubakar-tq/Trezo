# 0013. Hybrid pre-broadcast simulation + unified confirm sheet

Date: 2026-05-30
Status: Accepted
Path globs: apps/mobile/src/features/transactions/**, apps/mobile/src/integration/viem/revertDecoding.ts, apps/mobile/src/features/send/services/buildSendPreview.ts, apps/mobile/src/features/swaps/services/build*Preview.ts, apps/mobile/src/features/browser/components/dapp/buildDappPreview.ts, apps/mobile/src/features/wallet/screens/SendScreen.tsx, apps/mobile/src/features/dex/screens/DexScreen.tsx, apps/mobile/src/features/browser/components/dapp/SendTransactionSheet.tsx
Confidence: medium

## Context
FR-14/FR-15 and UC-04 require the wallet to let users approve/reject and **simulate** a transaction (gas fee, slippage, outcome) before broadcasting. The app was *quote-then-execute*: no pre-broadcast simulation, gas never shown as a value (only a "Sponsored" label), and three inconsistent confirm UIs (SendScreen review step, DexScreen inline, dApp `SendTransactionSheet`). Transactions are ERC-4337 UserOperations via the Pimlico bundler (ADR-0005); the testnet-demoable rule means whatever we pick must produce real, correct data on Base Sepolia.

## Decision
A **hybrid** simulation rendered through **one** theme-aware `TransactionConfirmSheet`. Each flow emits a normalized `TxPreview` (per-flow `buildXPreview` builders). `SimulationService.simulate` runs an `eth_call` **preflight** (revert verdict + decoded reason via the extracted `revertDecoding.ts`) and, for our own flows (send/swap/bridge), takes the **outcome deltas from the existing intent/quote** — no external API. Arbitrary **dApp** calldata escalates to an `AssetSimulationProvider` (`AlchemyAssetSimulationProvider`, `alchemy_simulateAssetChanges`) that returns `null` → status `"unknown"` when no endpoint/support (graceful degrade). Gas fee is computed from the **unsigned** prepared UserOp; `useTransactionConfirmation` orchestrates prepare → simulate → present → resolve; existing `SmartAccountExecutionService` prepare/sign/submit is reused untouched. Visual = Direction B (balance-changes card), dark-first, theme-driven.

## Alternatives considered
- **Provider asset-sim for ALL flows (Alchemy/Tenderly everywhere)** — rejected: adds a third-party API dependency on the critical path and a network round-trip even for trivial native sends, and risks the testnet-demoable rule if the provider lacks Base Sepolia support. Our own flows already know their outcome from the quote.
- **Preflight + derived only (no provider at all)** — rejected: blind to *surprise* token movements / hidden approvals on arbitrary dApp calldata we don't author; FR-15 "outcome prediction" would be pass/fail-only for dApp interactions.
- **Keep three per-flow confirm UIs, bolt simulation onto each** — rejected: triplicates the simulation wiring and perpetuates the inconsistent, cluttered UX; harder to make one clean Phantom-grade surface.

## Consequences
**Positive:** Real gas + outcome + will-succeed verdict before signing, on Base Sepolia today, with zero external dependency for send/swap/bridge. One sheet to design, polish, and extend (new flows just emit a `TxPreview`). Preflight doubles as a safety gate (a reverting/stale swap disables Approve), partly replacing the old quote-staleness recheck.
**Negative:** dApp asset-delta richness depends on an optional Alchemy endpoint; without it, dApp shows "unknown". The dApp path prepares the UserOp twice (once for gas/sim here, once for the real send in BrowserScreen). Three execution services (`SendExecutionService`, `SwapExecutionService`, `BridgeExecutionService`) are now orphaned and pending removal.
**Watch for:** Alchemy `simulateAssetChanges` support on chain 84532 is **unconfirmed** (docs say "testnets" but Base Sepolia isn't explicitly listed) — if it proves unavailable, swap the provider body for Tenderly's simulate endpoint; the `AssetSimulationProvider` interface makes this a drop-in. Also: the `eth_call` preflight approximates 4337 execution (simulates the inner call from the account, not the full EntryPoint→validate→execute path).

## Code touchpoints
- `apps/mobile/src/features/transactions/types/txPreview.ts` — `TxPreview` / `SimulationResult` / `AssetDelta` / `GasFee`.
- `apps/mobile/src/features/transactions/services/SimulationService.ts` — preflight verdict + hybrid delta source.
- `apps/mobile/src/features/transactions/services/assetSim/` — `AssetSimulationProvider` interface, `AlchemyAssetSimulationProvider`, `NullAssetSimulationProvider`, `resolveAssetSimProvider`.
- `apps/mobile/src/features/transactions/hooks/useTransactionConfirmation.ts` — orchestrator (gas from unsigned prepared UserOp).
- `apps/mobile/src/features/transactions/components/TransactionConfirmSheet.tsx` (+ `confirmSheet/*`) — Direction B sheet, dark-first, theme-aware.
- `apps/mobile/src/integration/viem/revertDecoding.ts` — extracted reusable revert decoders + `decodeBundlerError`.
- `SendScreen.tsx`, `DexScreen.tsx`, `SendTransactionSheet.tsx` — flows routed through the sheet; `SmartAccountExecutionService` reused untouched.
