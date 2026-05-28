# Cross-chain Swap Operator Runbook (testnets)

Step-by-step to bring up ERC20↔ERC20 cross-chain swaps end-to-end across Sepolia, Base Sepolia, and Arbitrum Sepolia. Pairs with `2026-05-29-crosschain-erc20-and-polish-design.md` and `2026-05-11-testnet-deployment-playbook.md` (general infra deploy steps).

**Audience:** the operator with the `trezo-testnet-deployer` keystore and funded broadcaster. Run from WSL Ubuntu (`/mnt/d/trezo/contracts`) where Foundry lives; mobile dev runs natively on Windows.

---

## 0. Prerequisites

- Keystore unlocked: `cast wallet list` shows `trezo-testnet-deployer`.
- Broadcaster funded with > 0.05 testnet ETH on each of Sepolia / Base Sepolia / Arb Sepolia (Alchemy faucets — verify, top up if short).
- Env vars exported in WSL: `SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `ARB_SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`, `PIMLICO_API_KEY`.
- Across V3 self-hosted relayer running with a WETH+USDC float on all three sepolias (per ADR 0008). Without the relayer, deposits will refund after `BRIDGE_FILL_DEADLINE_SECONDS` and never settle on destination.

---

## 1. Pre-flight: verify SpokePool pins

`AcrossConfig.spokePool(chainId)` addresses are pinned. They should match what each network's SpokePool reports for itself.

```bash
make check-spokepool RPC_URL=$SEPOLIA_RPC_URL
make check-spokepool RPC_URL=$BASE_SEPOLIA_RPC_URL
make check-spokepool RPC_URL=$ARB_SEPOLIA_RPC_URL
```

Each should print `exists: true` and exit clean. If any returns the `SpokePoolMissing` revert, the address in `AcrossConfig.sol` is stale — pin the correct one from `across-protocol/contracts/deployments` before continuing.

---

## 2. Deploy infra (includes CrossChainExecutor)

`DeployInfra.s.sol` already covers CrossChainExecutor. Each sepolia gets a fresh CCE deterministically salted from `TREZO_CROSS_CHAIN_EXECUTOR_V2` and constructor args `(spokePool, swapRouter)` from `AcrossConfig`.

```bash
make deploy-sepolia       # writes deployments/sepolia/...
make deploy-base-sepolia  # writes deployments/base-sepolia/... + email recovery wrapper
make deploy-arb-sepolia   # writes deployments/arb-sepolia/...
```

After each: `cat contracts/deployments/<profile>.json | jq .crossChainExecutor` should show a non-zero address. If it's missing, see §6.

The deploy targets internally run `check-root-factory → check-spokepool → predict-infra → deploy-infra → verify-infra → (email) → sync-mobile → sync-abi` — no separate sync step needed.

---

## 3. Verify mobile-side manifests

After all three deploys, mobile manifests should have `crossChainExecutor`:

```bash
for net in sepolia base-sepolia arb-sepolia; do
  echo "=== $net ==="
  jq '{crossChainExecutor, chainId}' \
    apps/mobile/src/integration/contracts/deployment.$net.json
done
```

All three should print non-null `crossChainExecutor`. Mobile's `getBridgeConfig(networkKey).crossChainExecutor` reads from these.

---

## 4. (Optional) Verify the executor is callable end-to-end via Foundry fork

Before doing it from the app, prove the contract works with a forked-state simulation:

```bash
cd contracts
forge test --match-contract CrossChainExecutor -vvv --fork-url $BASE_SEPOLIA_RPC_URL
```

That should exercise the `handleV3AcrossMessage` decode + Uniswap V3 swap path, plus the refund fallback when the swap reverts.

---

## 5. Demo: app-side

In the mobile app on the Bridge tab:

### 5a. Same-asset bridge (regression)
1. Switch active chain to **Ethereum Sepolia**.
2. Pick sell token: **USDC**, amount: **1**.
3. Pick destination chain: **Base Sepolia** (or **Arb Sepolia**).
4. Confirm "You receive" shows ~1 USDC (minus the 30 bps fee).
5. Review → Confirm. Two UserOps land (approval + depositV3).
6. On the source chain explorer, find the SpokePool tx and confirm a `V3FundsDeposited` log.
7. Wait for the relayer to fill (~30s on testnets). On destination, USDC arrives at your smart account.

### 5b. Cross-chain swap (the new path)
1. Same setup: Sepolia source, USDC, 1 unit.
2. Destination: **Base Sepolia**.
3. Tap the **"You receive"** picker (only enabled when the executor is deployed on dest). Choose **WETH**.
4. Confirm the details card now shows two sections:
   - **You receive (est.) ~0.000XX WETH**
   - **Minimum out: 0.000YY WETH (XX bps slip)**
   - **Bridged via: ~1.0 USDC (canonical)**
   - **Dest pool fee: 0.30%**
5. Review → Confirm.
6. Source-chain `V3FundsDeposited` should now go to the **executor** (not the user wallet) — confirm `recipient` field in the log matches `deployment.base-sepolia.json::crossChainExecutor`.
7. Relayer fills the deposit. The SpokePool calls `executor.handleV3AcrossMessage(USDC, amount, relayer, message)`.
8. Executor swaps USDC→WETH on Uniswap V3, forwards WETH to your smart account. Confirm by `SwapExecuted` event on the executor.

### 5c. Refund path (intentional break)
1. Pick a destination output token that has no V3 pool on dest (e.g. some random ERC20). The quote should fail fast in the mobile UI with "No Uniswap V3 pool on … for …".
2. If you bypass that gate (or the pool has zero liquidity at the bridge moment), the executor's `try/catch` will refund the canonical bridged token to your smart account. Confirm via the `RefundIssued` event.

---

## 6. Troubleshooting

**`make deploy-X` fails on `check-spokepool`.** SpokePool pin in `AcrossConfig.sol` is stale. Update the address from `across-protocol/contracts/deployments/<chain>/SpokePool*.json` and rebuild.

**`deployments/<profile>.json` is missing `crossChainExecutor` after deploy.** Symptom of the bug fixed by commit "fix(contracts): preserve crossChainExecutor in DeployEmailRecovery manifest rewrite". If you're running against pre-fix scripts, re-run `make deploy-infra` (without re-running deploy-email) — DeployInfra writes the flat manifest with CCE; only DeployEmailRecovery used to overwrite it. With the fix applied, full `make deploy-X` works end-to-end.

**Mobile cross-chain quote throws "Cross-chain swap requires CrossChainExecutor on … but it is not deployed yet."** `getBridgeConfig(destNetworkKey).crossChainExecutor` is undefined. Check `deployment.<dest>.json` has the field; re-run `make sync-mobile DEPLOYMENT_PROFILE=<dest>`.

**Mobile cross-chain quote throws "No Uniswap V3 pool on … for canonical → outputToken."** The pair isn't in `apps/mobile/src/features/swaps/config/dexRegistry.ts` under the destination network. Add it there (with a verified `poolAddress` to skip factory roundtrips).

**Deposit lands on source but never settles on destination.** Across V3 relayer isn't running or isn't watching this route. Check `make relayer-up`, the relayer logs, and the float balances per ADR 0008. Past `fillDeadline`, the deposit auto-refunds on the source chain.

**Executor receives funds but `SwapExecuted`/`RefundIssued` never emits.** SpokePool didn't call `handleV3AcrossMessage` — likely because `message` was empty or the executor address is wrong. Check the source-chain deposit's `recipient` field (must be the executor address) and `message` (must be non-empty when destSwapRequired).

---

## 7. Mainnet checklist (not in this cycle, but flagged)

Before any mainnet rollout:
- Replace the flat-fee local compute in `BridgeQuoteService` with Across's real `suggested-fees` API (the current 30 bps is testnet-only because Trezo runs the only relayer there).
- Audit `CrossChainExecutor.sol` — single-file contract, but it holds bridged funds in flight; the refund path is the safety net.
- Replace direct Across integration with LI.FI / Socket / Squid per the spec aggregator requirement (deferred this cycle, see project memory).
- Pin Uniswap V3 SwapRouter02 addresses for all production chains in `AcrossConfig.sol`.
