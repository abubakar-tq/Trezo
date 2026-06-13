#!/usr/bin/env bash
# scripts/fork/auto-fund-accounts.sh
#
# Watch the Base mainnet fork for AccountDeployed events emitted by the
# AccountFactory and auto-seed each new smart account with ETH + USDC.
#
# Requires: cast (Foundry), python3
#
# Required env:
#   FORK_RPC_URL              - e.g. http://192.168.100.68:8545
#   ACCOUNT_FACTORY           - address of the Trezo AccountFactory on the fork
#   BASE_FORK_USDC_WHALE      - a USDC-rich Base mainnet address
#
# Optional env:
#   SEED_NATIVE_ETH           - ETH to seed per account (default: 2)
#   SEED_USDC                 - USDC to seed per account (default: 1000)
#   POLL_INTERVAL             - seconds between polls (default: 3)

set -euo pipefail

SCRIPT_DIR_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT_EARLY="$(cd "$SCRIPT_DIR_EARLY/../.." && pwd)"
ENVFILE="$REPO_ROOT_EARLY/.env.local"
if [ -f "$ENVFILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENVFILE"
  set +a
fi

: "${FORK_RPC_URL:?Set FORK_RPC_URL}"
: "${ACCOUNT_FACTORY:?Set ACCOUNT_FACTORY to the deployed AccountFactory address}"
: "${BASE_FORK_USDC_WHALE:?Set BASE_FORK_USDC_WHALE}"

SEED_NATIVE_ETH="${SEED_NATIVE_ETH:-2}"
SEED_USDC="${SEED_USDC:-1000}"
POLL_INTERVAL="${POLL_INTERVAL:-3}"

# AccountDeployed(address indexed account, address indexed owner)
# topic0 = keccak256("AccountDeployed(address,address)")
ACCOUNT_DEPLOYED_TOPIC="0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_SCRIPT="$SCRIPT_DIR/seed-base-swap-wallet.sh"

if ! command -v cast &>/dev/null; then
  echo "❌ 'cast' not found. Install Foundry: https://getfoundry.sh"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  Trezo Base Fork — Auto-Fund Account Watcher"
echo "  Factory:     $ACCOUNT_FACTORY"
echo "  Fork RPC:    $FORK_RPC_URL"
echo "  Seed ETH:    $SEED_NATIVE_ETH  |  USDC: $SEED_USDC"
echo "  Polling every ${POLL_INTERVAL}s"
echo "═══════════════════════════════════════════════════════════"

# Track last processed block so we don't re-seed on restart
LAST_BLOCK=$(cast block-number --rpc-url "$FORK_RPC_URL")
echo "▶  Starting from block $LAST_BLOCK"

declare -A FUNDED

while true; do
  sleep "$POLL_INTERVAL"

  CURRENT_BLOCK=$(cast block-number --rpc-url "$FORK_RPC_URL" 2>/dev/null) || continue

  if [ "$CURRENT_BLOCK" -le "$LAST_BLOCK" ]; then
    continue
  fi

  FROM_BLOCK=$(( LAST_BLOCK + 1 ))

  # Fetch AccountDeployed logs in the new block range
  LOGS=$(cast logs \
    --from-block "$FROM_BLOCK" \
    --to-block "$CURRENT_BLOCK" \
    --address "$ACCOUNT_FACTORY" \
    "$ACCOUNT_DEPLOYED_TOPIC" \
    --rpc-url "$FORK_RPC_URL" \
    --json 2>/dev/null) || { LAST_BLOCK="$CURRENT_BLOCK"; continue; }

  # Parse each log's first topic (the account address — last 20 bytes of topic1)
  while IFS= read -r ACCOUNT; do
    [ -z "$ACCOUNT" ] && continue
    [ "${FUNDED[$ACCOUNT]+exists}" ] && continue

    echo ""
    echo "🆕  New account deployed: $ACCOUNT  (block $CURRENT_BLOCK)"
    echo "⟳   Seeding with $SEED_NATIVE_ETH ETH + $SEED_USDC USDC..."

    FORK_RPC_URL="$FORK_RPC_URL" \
    SMART_ACCOUNT_ADDRESS="$ACCOUNT" \
    BASE_FORK_USDC_WHALE="$BASE_FORK_USDC_WHALE" \
    SEED_NATIVE_ETH="$SEED_NATIVE_ETH" \
    SEED_USDC="$SEED_USDC" \
      bash "$SEED_SCRIPT" && FUNDED[$ACCOUNT]=1 || echo "⚠️  Seed failed for $ACCOUNT — will retry next block"

  done < <(echo "$LOGS" | python3 -c "
import sys, json
try:
    logs = json.load(sys.stdin)
    for log in logs:
        topics = log.get('topics', [])
        if len(topics) > 1:
            # topic1 = padded address; extract last 40 hex chars
            print('0x' + topics[1][-40:])
except Exception:
    pass
")

  LAST_BLOCK="$CURRENT_BLOCK"
done
