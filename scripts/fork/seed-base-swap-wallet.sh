#!/usr/bin/env bash
# scripts/fork/seed-base-swap-wallet.sh
#
# Seed a Trezo smart account on the Base mainnet fork with:
#   - Native ETH (via anvil_setBalance)
#   - Real forked USDC (via impersonation of a USDC whale)
#   - Optionally WETH (via impersonation of a WETH whale)
#
# Required env:
#   FORK_RPC_URL              - e.g. http://192.168.100.68:8545
#   SMART_ACCOUNT_ADDRESS     - the Trezo smart account to fund
#   BASE_FORK_USDC_WHALE      - a Base mainnet USDC holder address (large balance)
#
# Optional env:
#   BASE_FORK_WETH_WHALE      - a Base mainnet WETH holder (for WETH seeding)
#   SEED_NATIVE_ETH           - amount of ETH to set (default: 2)
#   SEED_USDC                 - amount of USDC to transfer (default: 1000)
#   SEED_WETH                 - amount of WETH to transfer (default: 0 = skip)

set -euo pipefail

# ─── Required inputs ──────────────────────────────────────────────────────────
: "${FORK_RPC_URL:?Set FORK_RPC_URL (e.g. http://192.168.100.68:8545)}"
: "${SMART_ACCOUNT_ADDRESS:?Set SMART_ACCOUNT_ADDRESS to the Trezo smart account address}"
: "${BASE_FORK_USDC_WHALE:?Set BASE_FORK_USDC_WHALE to a USDC-rich address on Base}"

# ─── Optional inputs with defaults ───────────────────────────────────────────
SEED_NATIVE_ETH="${SEED_NATIVE_ETH:-2}"
SEED_USDC="${SEED_USDC:-1000}"
SEED_WETH="${SEED_WETH:-0}"

# ─── Base mainnet token addresses ────────────────────────────────────────────
BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
BASE_WETH="0x4200000000000000000000000000000000000006"

# ─── Helpers ─────────────────────────────────────────────────────────────────
hex_pad32() {
  printf "0x%064x" "$1"
}

eth_to_wei_hex() {
  # Convert ETH decimal to hex wei using bash arithmetic (integer)
  local eth="$1"
  local wei
  # Multiply by 1e18 — use python for float precision
  wei=$(python3 -c "print(int(float('$eth') * 10**18))")
  printf "0x%x" "$wei"
}

usdc_to_raw() {
  # USDC has 6 decimals
  python3 -c "print(int(float('$1') * 10**6))"
}

weth_to_raw() {
  # WETH has 18 decimals
  python3 -c "print(int(float('$1') * 10**18))"
}

check_cast() {
  if ! command -v cast &>/dev/null; then
    echo "❌ 'cast' not found. Install Foundry: https://getfoundry.sh"
    exit 1
  fi
}

# ─── Preflight ────────────────────────────────────────────────────────────────
check_cast

echo "═══════════════════════════════════════════════════════════════════"
echo "  Trezo Base Fork — Wallet Seed Script"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Fork RPC:            $FORK_RPC_URL"
echo "  Smart Account:       $SMART_ACCOUNT_ADDRESS"
echo "  USDC whale:          $BASE_FORK_USDC_WHALE"
echo "  Seed ETH:            $SEED_NATIVE_ETH ETH"
echo "  Seed USDC:           $SEED_USDC USDC"
echo "  Seed WETH:           $SEED_WETH WETH"
echo "═══════════════════════════════════════════════════════════════════"

# Verify chain-id = 8453
CHAIN_ID=$(cast chain-id --rpc-url "$FORK_RPC_URL")
if [ "$CHAIN_ID" != "8453" ]; then
  echo "❌ Chain ID is $CHAIN_ID, expected 8453. Is the Base fork running?"
  exit 1
fi
echo "✅ Chain ID: $CHAIN_ID"

BLOCK=$(cast block-number --rpc-url "$FORK_RPC_URL")
echo "📦 Current fork block: $BLOCK"

# ─── 1. Set native ETH balance ───────────────────────────────────────────────
echo ""
echo "⟳  Setting native ETH balance to $SEED_NATIVE_ETH ETH..."
NATIVE_WEI_HEX=$(eth_to_wei_hex "$SEED_NATIVE_ETH")
cast rpc anvil_setBalance "$SMART_ACCOUNT_ADDRESS" "$NATIVE_WEI_HEX" \
  --rpc-url "$FORK_RPC_URL"
ETH_AFTER=$(cast balance "$SMART_ACCOUNT_ADDRESS" --rpc-url "$FORK_RPC_URL")
echo "✅ Native ETH balance: $ETH_AFTER wei"

# ─── 2. Transfer real forked USDC ────────────────────────────────────────────
echo ""
echo "⟳  Checking USDC balance before..."
USDC_BEFORE=$(cast call "$BASE_USDC" \
  "balanceOf(address)(uint256)" \
  "$SMART_ACCOUNT_ADDRESS" \
  --rpc-url "$FORK_RPC_URL")
echo "   USDC before: $USDC_BEFORE (raw)"

echo "⟳  Funding USDC whale with ETH for gas (anvil_setBalance)..."
# Without this, impersonated sends fail with "Out of gas: gas required exceeds allowance: 0"
# because the whale has 0 ETH on the fork view that cast uses for estimation.
cast rpc anvil_setBalance "$BASE_FORK_USDC_WHALE" "0x56BC75E2D63100000" \
  --rpc-url "$FORK_RPC_URL" >/dev/null

echo "⟳  Impersonating USDC whale: $BASE_FORK_USDC_WHALE"
cast rpc anvil_impersonateAccount "$BASE_FORK_USDC_WHALE" \
  --rpc-url "$FORK_RPC_URL"

USDC_AMOUNT_RAW=$(usdc_to_raw "$SEED_USDC")
echo "⟳  Transferring $SEED_USDC USDC ($USDC_AMOUNT_RAW raw) to $SMART_ACCOUNT_ADDRESS..."
USDC_TX=$(cast send "$BASE_USDC" \
  "transfer(address,uint256)(bool)" \
  "$SMART_ACCOUNT_ADDRESS" \
  "$USDC_AMOUNT_RAW" \
  --from "$BASE_FORK_USDC_WHALE" \
  --unlocked \
  --rpc-url "$FORK_RPC_URL" \
  --json | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash','unknown'))")
echo "   USDC transfer tx: $USDC_TX"

cast rpc anvil_stopImpersonatingAccount "$BASE_FORK_USDC_WHALE" \
  --rpc-url "$FORK_RPC_URL"

USDC_AFTER=$(cast call "$BASE_USDC" \
  "balanceOf(address)(uint256)" \
  "$SMART_ACCOUNT_ADDRESS" \
  --rpc-url "$FORK_RPC_URL")
echo "✅ USDC after: $USDC_AFTER (raw)"

# ─── 3. Optional WETH seeding ────────────────────────────────────────────────
if [ -n "${BASE_FORK_WETH_WHALE:-}" ] && [ "$(python3 -c "print(float('$SEED_WETH') > 0)")" = "True" ]; then
  echo ""
  echo "⟳  Checking WETH balance before..."
  WETH_BEFORE=$(cast call "$BASE_WETH" \
    "balanceOf(address)(uint256)" \
    "$SMART_ACCOUNT_ADDRESS" \
    --rpc-url "$FORK_RPC_URL")
  echo "   WETH before: $WETH_BEFORE (raw)"

  echo "⟳  Funding WETH whale with ETH for gas (anvil_setBalance)..."
  cast rpc anvil_setBalance "$BASE_FORK_WETH_WHALE" "0x56BC75E2D63100000" \
    --rpc-url "$FORK_RPC_URL" >/dev/null

  echo "⟳  Impersonating WETH whale: $BASE_FORK_WETH_WHALE"
  cast rpc anvil_impersonateAccount "$BASE_FORK_WETH_WHALE" \
    --rpc-url "$FORK_RPC_URL"

  WETH_AMOUNT_RAW=$(weth_to_raw "$SEED_WETH")
  echo "⟳  Transferring $SEED_WETH WETH ($WETH_AMOUNT_RAW raw) to $SMART_ACCOUNT_ADDRESS..."
  WETH_TX=$(cast send "$BASE_WETH" \
    "transfer(address,uint256)(bool)" \
    "$SMART_ACCOUNT_ADDRESS" \
    "$WETH_AMOUNT_RAW" \
    --from "$BASE_FORK_WETH_WHALE" \
    --unlocked \
    --rpc-url "$FORK_RPC_URL" \
    --json | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash','unknown'))")
  echo "   WETH transfer tx: $WETH_TX"

  cast rpc anvil_stopImpersonatingAccount "$BASE_FORK_WETH_WHALE" \
    --rpc-url "$FORK_RPC_URL"

  WETH_AFTER=$(cast call "$BASE_WETH" \
    "balanceOf(address)(uint256)" \
    "$SMART_ACCOUNT_ADDRESS" \
    --rpc-url "$FORK_RPC_URL")
  echo "✅ WETH after: $WETH_AFTER (raw)"
else
  echo ""
  echo "ℹ️  WETH seeding skipped (set BASE_FORK_WETH_WHALE and SEED_WETH > 0 to enable)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ Seed complete"
echo "  Smart account:       $SMART_ACCOUNT_ADDRESS"
echo "  USDC address:        $BASE_USDC"
echo "  WETH address:        $BASE_WETH"
echo "  USDC whale:          $BASE_FORK_USDC_WHALE"
echo ""
echo "  Before USDC:         $USDC_BEFORE"
echo "  After  USDC:         $USDC_AFTER"
echo "  Native ETH (wei):    $ETH_AFTER"
echo "═══════════════════════════════════════════════════════════════════"
