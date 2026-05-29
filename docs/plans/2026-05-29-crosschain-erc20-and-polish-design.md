# Cross-chain ERC20↔ERC20 swap + same-chain/bridge polish — Design

**Date:** 2026-05-29
**Branch:** `swaps/crosschain-erc20` (off `feat/mobile-polish-pass`)
**Scope owner:** Single implementation cycle. One PR back to `feat/mobile-polish-pass` when done.

## Goal

Make the swap + bridge surface testnet-demoable end-to-end across Sepolia / Base Sepolia / Arb Sepolia, including the missing ERC20↔ERC20 cross-chain swap path. Stay on the current direct architecture (Uniswap V3 + Across V3); no DEX aggregator or third-party routing API in this cycle.

## Out of scope

- DEX aggregator (1inch / 0x / Paraswap). Tracked separately — deferred per prior session.
- Third-party cross-chain routing API (LI.FI / Socket / Squid / Bungee). Same.
- Mainnet readiness. This cycle is testnet only.
- Anvil cross-chain. Anvil has no Across SpokePool; same-chain swap on Anvil keeps working as today.
- New token additions beyond USDC + WETH. Registry already covers them on the 3 sepolias.

## Current state (audit)

### What already works on `feat/mobile-polish-pass`

- **Same-chain swap** (`SwapQuoteService` → `UniswapV3Provider` → `UniswapV3Provider.exactInputSingle` with multicall+unwrapWETH9 for ERC20→native; `UniswapV2BaseProvider` fallback on Base): solid. Quote integrity asserts, allowance check, staleness/drift guard at 30s, 2-UserOp flow (approval → swap), receipt wait, balance refresh, classified errors.
- **Same-asset bridge** (`BridgeQuoteService` → `BridgePreparationService` → `BridgeExecutionService`): builds `SpokePool.depositV3` with `message="0x"` and `recipient = user wallet`. Approval → deposit UserOps. Across SpokePool addresses pinned for the 3 sepolias.
- **DexScreen**: Swap tab with countdown + manual refresh, gated by `networkConfig.swapSupported`. Bridge tab with destination picker + inline form. Wired to bridge services.
- **CrossChainExecutor contract** (`contracts/src/modules/CrossChainExecutor.sol`): implemented and tested. Decodes `BridgeMessage{recipient, buyToken, minOut, feeTier, deadline}`, swaps via Uniswap V3 SwapRouter02, refunds canonical token on failure.
- **`DeployInfra.s.sol`**: already deploys CrossChainExecutor through the root factory with deterministic `CROSS_CHAIN_EXECUTOR_SALT`. Constructor args sourced from `AcrossConfig.sol` per chainId.

### What's broken or missing

1. **No chain has `CrossChainExecutor` deployed yet.** Mobile deployment manifests on disk (`deployment.31337.json`, `deployment.base-sepolia.json`) have no `crossChainExecutor` field. `deployment.sepolia.json` and `deployment.arb-sepolia.json` don't exist at all.
2. **`BridgePreparationService.prepareBridge` throws when `destSwapRequired === true`** (line 283). This is the gate that blocks ERC20↔ERC20 cross-chain swap.
3. **`encodeBridgeMessage` has hardcoded zeros** for `minOut` and `feeTier` (lines 297–298), so even if the gate were removed the bridged funds would be swapped with no slippage protection.
4. **DexScreen bridge tab forces same-symbol output** (lines 418–423, 477–479). No way for a user to choose a different output token on the destination chain.
5. **`AcrossConfig.sol` flags SpokePool addresses as "PLACEHOLDERS pending verification"**. Pre-flight verification script (`CheckSpokePool.s.sol`) referenced in the comment doesn't exist.
6. **`DEPLOYMENTS.md` release schema doesn't include `crossChainExecutor`** in its salt list. Cosmetic but the doc is stale.

### Architecture (already-correct, validating)

- Mobile `BridgePreparationService.encodeBridgeMessage` encodes `(address, address, uint256, uint24, uint256)` matching contract's `_decode`. Field order and types align.
- Contract's `handleV3AcrossMessage` only accepts calls from `spokePool` and is the destination-chain `recipient` when a non-empty message accompanies the deposit. Across V3 SpokePool calls this entry point after delivering `tokenSent`.
- Refund path: if the Uniswap V3 swap reverts, executor `transfer`s the canonical token to `bridge.recipient`. Recipient is the **user wallet**, not the executor — verified in `BridgeMessage.recipient`. So a failed dest-side swap still credits the user with the bridged canonical token.

## Design

### 1. Deploy CrossChainExecutor + sync manifests (contracts side)

Re-run `make deploy-infra` against each of the 3 sepolias using existing scripts. CrossChainExecutor is already in `DeployInfra.s.sol`. No script changes required.

Then `make sync-mobile` to regenerate `apps/mobile/src/integration/contracts/deployment.{sepolia,base-sepolia,arb-sepolia}.json` with a `crossChainExecutor` field.

Pre-flight: add `contracts/script/CheckSpokePool.s.sol` that asserts each chain's `AcrossConfig.spokePool(chainid)` matches what the actual SpokePool reports for itself (i.e. `ISpokePool(addr).chainId()` returns expected). This addresses the "PLACEHOLDERS" comment without churning addresses we believe to be correct.

Anvil-local stays as today — `AcrossConfig.SPOKEPOOL_ANVIL_PLACEHOLDER` is `address(0)`, so executor deployment is skipped via the existing `hasExecutor(chainId)` guard.

### 2. Build `BridgeDestQuoteService` (mobile side)

New service: `apps/mobile/src/features/swaps/services/BridgeDestQuoteService.ts`.

**Responsibility:** Given destination chain + canonical bridged token + desired output token + post-fee canonical amount, return `(minOut: bigint, feeTier: number, deadline: number)` for the dest-side V3 swap, applied with slippage tolerance.

**Implementation:**
- Use the destination chain's viem `publicClient` (already in `integration/viem/clients.ts`).
- Use the destination chain's `dexRegistry` config to discover the V3 pool fee tier (`swapPoolWethUsdcFeeTier` is already in the deployment manifest schema).
- Call Uniswap V3 Quoter's `quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96=0)` and apply slippage on the returned `amountOut`.
- Fail explicitly if the chain's `dexRegistry` says swap isn't supported (e.g. healthcheck stale).

**Why a separate service:** keeps `BridgeQuoteService` pure-local (the existing "no hosted-fees-API call needed" design), and isolates the destination-chain RPC dependency so it can be mocked in tests independently.

### 3. Remove the `destSwapRequired` gate + wire real `minOut`/`feeTier`

In `BridgePreparationService.prepareBridge`:
- When `quote.destSwapRequired === true`, call `BridgeDestQuoteService` with the post-fee `quote.outputAmountRaw` (which is what the relayer delivers to the executor, before the dest-side swap) and the slippage from `intent.slippageBps`.
- Replace the `encodeBridgeMessage({ minOut: 0n, feeTier: 0, ... })` placeholder with the values returned by `BridgeDestQuoteService`.
- Keep the existing error/warning surface: a `destination_swap` warning is already emitted; extend it to include the expected output and slippage.

`BridgeQuoteService.getQuote` continues to gate on executor presence — that error is unchanged.

### 4. DexScreen bridge-tab UX

Today the bridge tab auto-picks the destination chain's matching-symbol token. Extend:
- Show an output-token picker on the bridge tab when `isCrossChainSwapReady(destNetworkKey) === true`. List tokens from the destination chain's registry. Default to same-symbol if available.
- Render dest-side swap details: `expectedOutput`, `minOut`, `slippageBps`, `feeTier`, with a clear visual separation from the bridge fee.
- Render two-step progress (`approval → bridge_deposit → relayed → dest_swap_executed`) inferred from the destination-chain executor event indexer (see §6).

### 5. Cleanup + small fixes

- Update `DEPLOYMENTS.md` to include `crossChainExecutorSalt` in the release schema example and list `crossChainExecutor` in the per-chain artifacts.
- Add brief comment block to `bridgeRegistry.ts` SpokePool constants: "verified by `make check-spoke-pool`" once the pre-flight script lands.
- `swapProviders.ts`: `isTrustedSpenderForNetwork` already accepts SpokePool addresses for the bridge approval. Verify no analogous gap for the executor (it never receives an ERC20 approval from the user — it acts on funds delivered by the SpokePool).

### 6. Optional: destination-side fill indexer (deferred but noted)

Right now the mobile app marks a bridge `confirmed` on source-chain receipt. The destination-side fill is async and the UI has no signal for it. The existing Ponder indexer (`apps/backend/indexer/`) already watches contracts — it can be extended to emit a `BridgeFilled` notification when CrossChainExecutor emits `SwapExecuted` or `RefundIssued`. Out of scope for this cycle unless a stretch goal — flagged for follow-up.

## Test plan

### Contract / Foundry

- Fork test: `test/modules/CrossChainExecutor.t.sol` already exists. Add a Base Sepolia fork case that simulates a SpokePool delivery of USDC and asserts a swap to WETH against the live Uniswap V3 pool succeeds (or the refund path triggers cleanly).
- `CheckSpokePool.s.sol` pre-flight runs against each sepolia RPC. Green = deploy.

### Mobile / integration

- Manual: bridge 1 USDC Sepolia → USDC Base Sepolia (existing same-asset path) — regression check.
- Manual: bridge 1 USDC Sepolia → WETH Base Sepolia (new ERC20↔ERC20 path). Verify dest-side `SwapExecuted` event with `recipient = user wallet`, `tokenIn = USDC`, `tokenOut = WETH`.
- Manual: bridge 1 USDC Sepolia → DAI Base Sepolia where DAI pool doesn't exist on destination. Verify executor's refund path returns USDC to user, mobile classifies the bridge as `confirmed_with_refund`.
- Quote staleness: leave a cross-chain quote open >30s, hit confirm, verify re-prepare picks up the new dest-side quote without drift errors below slippage.

### Runbook deliverable

`docs/dev/crosschain-swap-runbook.md` — step-by-step for: deploy infra on the 3 sepolias, sync mobile, top up testnet floats per ADR 0008's relayer, run a bridge + cross-chain-swap, capture transcript.

## Risks

| Risk | Mitigation |
|---|---|
| Across SpokePool addresses are wrong | `CheckSpokePool.s.sol` pre-flight before deploy |
| Uniswap V3 pool for the chosen (canonical, outputToken) pair doesn't exist on destination | `BridgeDestQuoteService` fails fast → UI shows "no destination pool — pick another output token" |
| Self-hosted Across relayer isn't running | Per ADR 0008, `make relayer-up`. Already a prerequisite for same-asset bridge — no new dependency. |
| Receipt on source ≠ destination fill | UI distinguishes "deposit confirmed (relayer working)" from "delivered". Stretch goal §6 closes the loop. |
| Cross-chain swap minOut too tight, relayer fills but executor swap reverts | Refund path delivers canonical token to user. UI surfaces `confirmed_with_refund` so the user knows to swap manually on destination. |

## Files touched (estimated)

**Contracts (small):**
- `contracts/script/CheckSpokePool.s.sol` — new (pre-flight)
- `contracts/DEPLOYMENTS.md` — schema update

**Mobile (medium):**
- `apps/mobile/src/features/swaps/services/BridgeDestQuoteService.ts` — new
- `apps/mobile/src/features/swaps/services/BridgePreparationService.ts` — remove gate + wire dest quote
- `apps/mobile/src/features/swaps/types/bridge.ts` — extend `BridgeQuote` / `BridgePlan` with dest-side fields
- `apps/mobile/src/features/dex/screens/DexScreen.tsx` — bridge tab output-token picker + dest-swap detail rendering
- `apps/mobile/src/integration/contracts/deployment.{sepolia,base-sepolia,arb-sepolia}.json` — regenerated by `make sync-mobile` after redeploy

**Docs:**
- `docs/dev/crosschain-swap-runbook.md` — new

**No backend / indexer / Supabase changes in this cycle.**

## Acceptance criteria

1. `make deploy-infra` runs cleanly on all 3 sepolias; each manifest has a non-zero `crossChainExecutor`.
2. Same-chain swap (Sepolia, Base Sepolia, Arb Sepolia) still works for native↔ERC20 and ERC20↔ERC20 — regression.
3. Same-asset bridge (USDC↔USDC, WETH↔WETH) between any two of the 3 sepolias still works — regression.
4. **New:** bridging 1 USDC from Sepolia and asking for WETH on Base Sepolia results in WETH arriving at the user's smart account, with `SwapExecuted` emitted by the destination executor.
5. **New:** when the dest-side swap is infeasible (no pool, wrong fee tier), the user receives the canonical bridged token and the mobile UI labels it `refunded on destination`.
6. Foundry tests pass: `forge test --match-contract CrossChainExecutor -vvv`.
7. Runbook in `docs/dev/crosschain-swap-runbook.md` reproduces the end-to-end demo.
