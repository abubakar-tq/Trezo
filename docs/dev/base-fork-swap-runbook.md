# Base Fork Swap Runbook

Developer guide for running and validating the full Trezo swap path against real forked Uniswap V3 liquidity on a Base mainnet fork.

## Prerequisites

- `foundry` (`anvil`, `cast`, `forge`) installed and on PATH
- `docker` with `docker compose` plugin
- Mobile app dependencies installed (`npm install`)
- Access to a Base mainnet RPC URL (Alchemy, Infura, or self-hosted)
- Infra laptop reachable at `192.168.100.68` from the phone/emulator

---

## Step 1 — Set Environment

```bash
export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/<YOUR_KEY>"
export BASE_FORK_BLOCK_NUMBER="<PINNED_BLOCK>"   # Use a recent stable block
export FORK_RPC_URL="http://192.168.100.68:8545"
export EXPO_PUBLIC_BASE_FORK_RPC_URL="http://192.168.100.68:8545"
export EXPO_PUBLIC_BASE_FORK_BUNDLER_URL="http://192.168.100.68:4337"
```

---

## Step 2 — Start Fork + Bundler (on infra laptop)

Run a single command on the infra laptop to start both the fork and the bundler:

```bash
make start-fork-and-bundler
```

Internally runs:

```bash
cd apps/backend/bundler && ./scripts/start-fork-and-bundler.sh
```

The helper script runs the existing `start-base-fork.sh` and then brings up the bundler compose stack. By default the compose stack is started detached; pass `--fg` to the script for foreground logs:

```bash
cd apps/backend/bundler && ./scripts/start-fork-and-bundler.sh --fg
```

Verify the fork is running:

```bash
cast chain-id --rpc-url "$FORK_RPC_URL"
# Should return: 8453
cast block-number --rpc-url "$FORK_RPC_URL"
```

Verify the bundler is available:

```bash
curl -s http://192.168.100.68:4337 -X POST \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_supportedEntryPoints","params":[],"id":1}'
# Should return: ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
```

> **If the mock paymaster fails:** Set `EXPO_PUBLIC_BASE_FORK_PAYMASTER_URL` to empty or unset it.  
> The app will use `defaultUsePaymaster: false` and rely on native ETH balance for gas.

---

## Step 4 — Deploy Trezo Infra to Fork

```bash
make deploy-fork-base
```

Internally runs (in `contracts/`):
```bash
make check-root-factory RPC_URL=http://192.168.100.68:8545
make predict-infra ...
make deploy-infra ... DEPLOYMENT_PROFILE=base-mainnet-fork
make verify-infra ...
make sync-mobile DEPLOYMENT_PROFILE=base-mainnet-fork
```

Verify manifest was generated:
```bash
ls -la apps/mobile/src/integration/contracts/deployment.base-mainnet-fork.json
cat apps/mobile/src/integration/contracts/deployment.base-mainnet-fork.json | jq .entryPoint
```

> **EntryPoint check:** If `cast code 0x0000000071727De22E5E9d8BAf0edAc6f37da032 --rpc-url $FORK_RPC_URL` returns `0x`, run the `contract-deployer` service first to deploy ERC-4337 system contracts.

---

## Step 5 — Start Mobile

```bash
npm start
```

In the Expo developer menu, make sure the correct network configuration is loaded.

---

## Step 6 — Deploy Smart Account on Base Fork

In the mobile app:
1. Go to **Settings → Networks** (or the account switcher if available).
2. Select **Base Fork**.
3. Tap **Deploy Smart Account**.
4. Sign with Face ID / Touch ID.

Verify:
```bash
cast code <SMART_ACCOUNT_ADDRESS> --rpc-url "$FORK_RPC_URL"
# Should return bytecode, not 0x
```

---

## Step 7 — Seed Wallet With ETH and USDC

Find a USDC whale on Base (e.g., from BaseScan's USDC token holders):
```bash
export SMART_ACCOUNT_ADDRESS="0xd3ab5fc84faa0396aff38cfea419e0f9cb338714"
export BASE_FORK_USDC_WHALE="0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a"  # e.g., 0xB9005f2ab2da0f408a4E4c3Af4A8d2e3AA2d4dEB

make seed-fork-swap-wallet
```

Or manually:
```bash
FORK_RPC_URL="$FORK_RPC_URL" \
SMART_ACCOUNT_ADDRESS="$SMART_ACCOUNT_ADDRESS" \
BASE_FORK_USDC_WHALE="$BASE_FORK_USDC_WHALE" \
SEED_USDC=1000 \
SEED_NATIVE_ETH=2 \
./scripts/fork/seed-base-swap-wallet.sh
```

Verify balances:
```bash
BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
BASE_WETH="0x4200000000000000000000000000000000000006"

cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL"
cast call "$BASE_WETH" "balanceOf(address)(uint256)" "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL"
cast balance "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL"
```

---

## Step 8 — Perform Swap in Mobile App

1. Open **Swap** tab.
2. Select network: **Base Fork**.
3. Sell: **USDC** — Enter amount (e.g., 100).
4. Buy: **WETH**.
5. Tap **Review Swap**.
6. Confirm the quote (should show real Uniswap V3 price).
7. If approval required: sign with passkey → wait for approval receipt.
8. Sign swap with passkey → wait for swap receipt.
9. Verify balances updated (USDC ↓, WETH ↑).
10. Check **Transaction History** — should show `token_approval` + `swap` rows under Base Fork.

---

## Debug Commands

```bash
# Fork state
cast chain-id --rpc-url "$FORK_RPC_URL"
cast block-number --rpc-url "$FORK_RPC_URL"

# Token balances
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL"
cast call "$BASE_WETH" "balanceOf(address)(uint256)" "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL"

# Verify Uniswap V3 pool exists at fork block
FACTORY="0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
cast call "$FACTORY" "getPool(address,address,uint24)(address)" \
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" \
  "0x4200000000000000000000000000000000000006" \
  500 \
  --rpc-url "$FORK_RPC_URL"

# Verify contracts exist
cast code 0x0000000071727De22E5E9d8BAf0edAc6f37da032 --rpc-url "$FORK_RPC_URL"   # EntryPoint
cast code 0x2626664c2603336E57B271c5C0b26F421741e481 --rpc-url "$FORK_RPC_URL"   # SwapRouter02
cast code 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a --rpc-url "$FORK_RPC_URL"   # QuoterV2
```

---

## Failure Cases and Remediation

| Failure | Cause | Remediation |
|---------|-------|-------------|
| `chain_id != 8453` | Fork not running | `make fork-base` |
| `eth_supportedEntryPoints` empty | Bundler not running | `make bundler-fork-base` |
| `entryPoint has no bytecode` | ERC-4337 contracts not deployed | `docker compose run contract-deployer` |
| `No DEX config found` | Missing dexRegistry entry | Check `dexRegistry.ts` |
| `No pool found for USDC/WETH 500` | Wrong fee tier at fork block | Try fee tier `3000` in dexRegistry.ts |
| `QuoterV2 quote failed` | Pool has no liquidity at fork block | Use a more recent fork block |
| `Untrusted spender` | Wrong spender address | Verify router address vs dexRegistry.ts |
| `Approval receipt timeout` | Bundler overloaded or restarted | Wait or restart bundler |
| `Paymaster sponsorship failed` | Mock paymaster rejects DEX simulation | Unset `EXPO_PUBLIC_BASE_FORK_PAYMASTER_URL` |
| `Insufficient USDC` | Seed not run | `make seed-fork-swap-wallet` |
| `Smart account not deployed` | Forgot to deploy | Go to Deploy screen on Base Fork |

---

## Known Contract Addresses (Base Mainnet)

```
USDC:            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WETH:            0x4200000000000000000000000000000000000006
UniswapV3Factory: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
QuoterV2:        0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
SwapRouter02:    0x2626664c2603336E57B271c5C0b26F421741e481
UniversalRouter: 0x6fF5693b99212Da76ad316178A184AB56D299b43
Permit2:         0x000000000022D473030F116dDEE9F6B43aC78BA3
EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```
