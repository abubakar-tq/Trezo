# Testnet Deployment Playbook

> **Purpose:** Step-by-step guide to deploy Trezo's infrastructure to Sepolia, Base Sepolia, and Arbitrum Sepolia. All the contract code, mobile registry wiring, and relayer scaffolding is already in place on branch `feat/mobile-polish-pass`. This document is the *operator-side* runbook.

**Status:** Phases 1-8 complete and committed. Phase 9 (this playbook) requires user-supplied secrets.

**See also:**
- Design spec: `docs/superpowers/specs/2026-05-11-testnet-deployment-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-11-testnet-deployment.md`
- ADRs: `docs/decisions/0001..0004-*.md`

---

## What's already done (no action needed)

| Layer | What landed |
|---|---|
| Contracts | `isPortableChain()` accepts 84532 + 421614; `CrossChainExecutor.sol` written, tested (5 tests), wired into `DeployInfra`/`PredictInfra`/`VerifyInfra`; `AcrossConfig.sol` pins per-chain SpokePool + SwapRouter02 lookups |
| Scripts | `CheckSpokePool.s.sol` pre-flight; `CheckSwapPools.s.sol` healthcheck; `SeedSwapLiquidity.s.sol` idempotent LP top-up |
| Makefile | `deploy-sepolia` / `deploy-base-sepolia` / `deploy-arb-sepolia` / `verify-chain` / `swap-healthcheck` / `seed-swap-liquidity` / `relayer-up` / `relayer-down` / `relayer-logs` / `relayer-status` |
| Mobile | `NetworkKey` gains `base-sepolia` + `arbitrum-sepolia`; per-feature flags (`swapSupported`, `emailRecoverySupported`, `crossChainSwapSupported`); `dexRegistry.ts` entries for all 3 testnets; new `bridgeRegistry.ts` with Across SpokePool + route allowlist; `tokenRegistry.ts` with WETH + Circle faucet USDC per chain; env example files |
| Relayer | `infra/relayer/` with `docker-compose.yml`, `relayer.config.json`, `.env.example`, `README.md` runbook |
| Docs | `CONTEXT.md` glossary updated (Same-chain swap, Cross-chain swap, CrossChainExecutor, Across relayer (self-hosted)); 4 ADRs logged |

---

## What you do, in order

### Step 1 — Verify pinned addresses (5 min)

The Across SpokePool addresses in code are placeholders. Open `https://github.com/across-protocol/contracts/tree/master/deployments` and confirm the current addresses for chains `11155111`, `84532`, `421614`. If they differ from the placeholders, update all three files:

- `contracts/script/common/AcrossConfig.sol` (constants `SPOKEPOOL_SEPOLIA`, `SPOKEPOOL_BASE_SEPOLIA`, `SPOKEPOOL_ARB_SEPOLIA`)
- `apps/mobile/src/features/swaps/config/bridgeRegistry.ts` (same three constants near the top)
- `infra/relayer/relayer.config.json` (`chains.{chainId}.spokePool` for each entry)

After editing, run a sanity build:

```bash
# WSL, in /mnt/d/trezo/contracts
forge build
```

### Step 2 — Generate the deployer keystore (2 min, one-time)

```bash
cast wallet import trezo-testnet-deployer --interactive
```

You'll be prompted for a private key and a password. Generate a fresh key (`cast wallet new` first, copy the private key into the import prompt). **Write the password down somewhere safe** — Foundry will prompt for it on every deploy.

Copy the resulting address; you'll fund it in the next step.

### Step 3 — Fund the deployer (15 min, one-time)

Send testnet ETH to the deployer address on each of the 3 testnets. Faucets:

| Chain | Faucet |
|---|---|
| Sepolia | https://www.alchemy.com/faucets/ethereum-sepolia or https://sepoliafaucet.com |
| Base Sepolia | https://www.alchemy.com/faucets/base-sepolia or https://faucet.circle.com |
| Arbitrum Sepolia | https://www.alchemy.com/faucets/arbitrum-sepolia |

Aim for ~0.1 ETH on each. Verify:

```bash
cast balance <DEPLOYER_ADDRESS> --rpc-url <SEPOLIA_RPC_URL> --ether
cast balance <DEPLOYER_ADDRESS> --rpc-url https://sepolia.base.org --ether
cast balance <DEPLOYER_ADDRESS> --rpc-url https://sepolia-rollup.arbitrum.io/rpc --ether
```

### Step 4 — Collect API keys (10 min, one-time)

| Key | Source | Used for |
|---|---|---|
| `PIMLICO_API_KEY` | https://dashboard.pimlico.io | Bundler + paymaster on all 3 testnets |
| `ETHERSCAN_API_KEY` | https://etherscan.io/myapikey | One v2 multichain key verifies on Etherscan + Basescan + Arbiscan |
| `SEPOLIA_RPC_URL` | https://www.alchemy.com or https://www.infura.io | Sepolia RPC (free tier OK) |
| `BASE_SEPOLIA_RPC_URL` (optional) | https://sepolia.base.org is free public | Override with Alchemy if rate-limited |
| `ARB_SEPOLIA_RPC_URL` (optional) | Public default works; Alchemy if needed | Same |

### Step 5 — Configure env files

#### `contracts/.env` (gitignored)

Add these (keep existing entries):

```env
ETHERSCAN_API_KEY=<your Etherscan v2 key>
SEPOLIA_RPC_URL=<your Sepolia RPC>
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

#### `apps/mobile/.env` (gitignored)

Copy the new entries from `apps/mobile/.env.example` and fill in `YOUR_PIMLICO_KEY`:

```env
EXPO_PUBLIC_SEPOLIA_RPC_URL=<same as above>
EXPO_PUBLIC_SEPOLIA_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=<PIMLICO_KEY>
EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=<PIMLICO_KEY>

EXPO_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL=https://api.pimlico.io/v2/base-sepolia/rpc?apikey=<PIMLICO_KEY>
EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL=https://api.pimlico.io/v2/base-sepolia/rpc?apikey=<PIMLICO_KEY>

EXPO_PUBLIC_ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL=https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=<PIMLICO_KEY>
EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL=https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=<PIMLICO_KEY>
```

### Step 6 — Deploy each testnet (≈5 min per chain)

From `contracts/`:

```bash
make deploy-sepolia
```

Foundry will:
1. Prompt for your `trezo-testnet-deployer` password
2. Run `check-root-factory` → `check-chain-support` → `check-spokepool` → `predict-infra`
3. Submit a batched broadcast that deploys all 6 contracts (SmartAccount impl, AccountFactory, MinimalProxyFactory, PasskeyValidator, SocialRecovery, CrossChainExecutor)
4. Verify each on Etherscan
5. Write `contracts/deployments/sepolia.json` and sync it to `apps/mobile/src/integration/contracts/deployment.sepolia.json`
6. Sync ABIs

Repeat for the other two:

```bash
make deploy-base-sepolia
make deploy-arb-sepolia
```

If Etherscan verification fails mid-run (it happens), don't re-deploy. Use:

```bash
make verify-chain CHAIN=sepolia       # or base-sepolia / arb-sepolia
```

### Step 7 — Verify the deploys

```bash
# Each chain — read addresses out of the manifest
cat contracts/deployments/sepolia.json
cat contracts/deployments/base-sepolia.json
cat contracts/deployments/arb-sepolia.json

# Mobile manifests synced?
ls apps/mobile/src/integration/contracts/
# should show deployment.31337.json, deployment.base-mainnet-fork.json,
#         deployment.sepolia.json, deployment.base-sepolia.json, deployment.arb-sepolia.json
```

Open Etherscan / Basescan / Arbiscan and confirm the source code is verified for at least `AccountFactory` and `CrossChainExecutor` on each chain.

### Step 8 — Run swap healthcheck (per chain, 1 min each)

The healthcheck probes Uniswap V3 pool liquidity and writes `swapSupported` into the manifest. If a pool is dead, the mobile UI hides Swap on that chain.

First, pin the WETH↔USDC pool address in each manifest. Open the Uniswap V3 factory on each chain in the block explorer, call `getPool(weth, usdc, 500)`, and add the returned address to the manifest's `swapPoolWethUsdc` field. Or do it in one shot:

```bash
# For each chain
cast call <UNISWAP_V3_FACTORY> "getPool(address,address,uint24)(address)" <WETH> <USDC> 500 --rpc-url <RPC>
# Then edit the manifest:
#   contracts/deployments/<profile>.json
#   add: "swapPoolWethUsdc": "<the address from cast call>"
```

Then run the healthcheck:

```bash
make swap-healthcheck DEPLOYMENT_PROFILE=sepolia RPC_URL=$SEPOLIA_RPC_URL
make swap-healthcheck DEPLOYMENT_PROFILE=base-sepolia RPC_URL=https://sepolia.base.org
make swap-healthcheck DEPLOYMENT_PROFILE=arb-sepolia RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

If a pool's `liquidity() == 0`, `swapSupported` becomes `false` and the mobile Swap action will hide on that chain.

### Step 9 — Smoke test from the mobile app

```bash
cd apps/mobile
npx expo start
```

On a real device (passkey requires it):
1. Switch network to **Base Sepolia** (the easiest first target — has email recovery + reliable Uniswap)
2. Trigger Activation sheet → confirm the smart account deploys via Pimlico paymaster
3. Use Receive to get an address → send testnet ETH from your other wallet → confirm it arrives
4. Try Send (small amount) and confirm it lands
5. If swap-healthcheck said Swap is enabled, try a USDC↔WETH swap

Repeat on Sepolia and Arbitrum Sepolia. Verify the Swap tile is hidden on any chain where `swapSupported == false`.

### Step 10 — Cross-chain demo (with the on-demand relayer)

#### One-time relayer setup

```bash
# 1. Make a throwaway relayer wallet
cast wallet new

# 2. Fund it with WETH + USDC on each testnet (~$50 each)
#    USDC: https://faucet.circle.com
#    WETH: wrap native ETH via the WETH contract's deposit()

# 3. Configure infra/relayer/.env (NOT relayer.config.json — that's the schema)
cd infra/relayer
cp .env.example .env
# Edit .env with RELAYER_PRIVATE_KEY and the 3 RPC URLs

# 4. Pin a specific docker image tag in docker-compose.yml
#    Check https://github.com/across-protocol/relayer/pkgs/container/relayer
#    Replace "latest" with a specific version like "v3.X.X"
```

#### Per-demo lifecycle

```bash
# Before the demo
cd contracts
make relayer-up      # docker compose up -d
make relayer-logs    # tail in another terminal

# Trigger cross-chain swap in the mobile app
# (e.g. USDC on Base Sepolia → ETH on Arbitrum Sepolia)
# Watch for: "Detected new V3 deposit" → "Submitting fillRelay" → "Fill confirmed"

# After the demo
make relayer-down
```

The full relayer runbook with troubleshooting lives at `infra/relayer/README.md`.

---

## Quick reference — every Make target you'll use

```bash
# Deploy
make deploy-sepolia
make deploy-base-sepolia
make deploy-arb-sepolia

# Retry verification
make verify-chain CHAIN=sepolia
make verify-chain CHAIN=base-sepolia
make verify-chain CHAIN=arb-sepolia

# Swap pool ops
make swap-healthcheck DEPLOYMENT_PROFILE=<chain> RPC_URL=<url>
make seed-swap-liquidity DEPLOYMENT_PROFILE=<chain> RPC_URL=<url>

# Cross-chain demos
make relayer-up
make relayer-logs
make relayer-down
make relayer-status

# Pre-flight standalone
make check-spokepool RPC_URL=<url>
make check-root-factory RPC_URL=<url>
make check-chain-support RPC_URL=<url>
```

---

## Verification checklist

Before declaring testnet deployment "done":

- [ ] Across SpokePool addresses verified against `across-protocol/contracts` repo
- [ ] `trezo-testnet-deployer` keystore created and password stored
- [ ] Deployer address funded with ~0.1 ETH on all 3 testnets
- [ ] Pimlico API key + Etherscan v2 API key in `contracts/.env` and `apps/mobile/.env`
- [ ] `make deploy-sepolia` completed without errors
- [ ] `make deploy-base-sepolia` completed without errors
- [ ] `make deploy-arb-sepolia` completed without errors
- [ ] All 5 contracts visible and verified on each block explorer
- [ ] `apps/mobile/src/integration/contracts/deployment.<chain>.json` exists for all 3 testnets
- [ ] Mobile app's `getEnabledNetworks()` returns all 3 testnets when env vars are set
- [ ] Activation sheet completes on at least Base Sepolia
- [ ] Same-chain swap works on at least Base Sepolia (where pools are most reliable)
- [ ] Relayer wallet created and funded (deferred until cross-chain demo needed)

---

## What's intentionally out of scope (separate spec needed)

Per ADR scope decisions, these are NOT part of this push:

- **Indexer chain configs** — `apps/backend/indexer/` needs new RPC URLs and contract address lookups for the 3 testnets. Separate spec because Ponder schema versioning is its own concern.
- **Supabase backend** — cross-chain email recovery tables, multichain group sync. Already partially implemented; needs testnet chainId rows.
- **Mainnet deployment** — explicitly deferred. Mainnet introduces governance / audit / paymaster funding / Across mainnet relayer race concerns that don't apply to testnet.
- **DEX provider abstraction** — `dexRegistry.ts` is currently Uniswap-V3-only.

When the testnet phase is stable, those land as follow-on plans.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `RootFactoryMissing` revert at deploy | Safe Singleton Factory not on the chain | Unlikely — Safe operates the factory on every major chain. Re-check `block.chainid` matches the RPC. |
| `SpokePoolMissing` revert at `check-spokepool` | Pinned SpokePool address is stale | Update from `across-protocol/contracts/deployments` and re-run |
| Etherscan verify fails mid-deploy | Explorer indexer lagging | Wait 30s, run `make verify-chain CHAIN=<chain>` |
| Mobile says chain disabled | Missing env var | Check `bundlerUrl` for that chain is set in `.env` |
| Cross-chain bridge takes hours on testnet | Relayer not running | `make relayer-up` |
| Relayer logs show `InsufficientBalance` | Relayer wallet needs more tokens on dest chain | Top up via faucet, restart relayer |
| Swap UI hidden on a testnet | `swapSupported == false` (pool died) | Re-run `swap-healthcheck`; if still false, the pool needs LP — manual or via `seed-swap-liquidity` |
