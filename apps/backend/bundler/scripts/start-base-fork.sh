#!/usr/bin/env bash
# apps/backend/bundler/scripts/start-base-fork.sh
#
# Start an Anvil instance that forks Base mainnet at a pinned block.
# The fork listens on the infra laptop's IP so the mobile device can reach it.
#
# Required env:
#   BASE_RPC_URL          - upstream Base mainnet RPC (e.g., from Alchemy/Infura)
#   BASE_FORK_BLOCK_NUMBER - pinned block to fork from (for determinism)
#
# Optional env:
#   FORK_HOST        (default: 0.0.0.0)
#   FORK_PORT        (default: 8545)
#   FORK_BLOCK_TIME  (default: 1 second)

set -euo pipefail

: "${BASE_RPC_URL:?Set BASE_RPC_URL to an upstream Base mainnet RPC (e.g. https://base-mainnet.g.alchemy.com/v2/<KEY>)}"
: "${BASE_FORK_BLOCK_NUMBER:?Set BASE_FORK_BLOCK_NUMBER to a pinned block number for determinism}"

HOST="${FORK_HOST:-0.0.0.0}"
PORT="${FORK_PORT:-8545}"

echo "🔱 Starting Base mainnet fork"
echo "   RPC:          $BASE_RPC_URL"
echo "   Block:        $BASE_FORK_BLOCK_NUMBER"
echo "   Listen:       ${HOST}:${PORT}"
echo ""

exec anvil \
  --host "$HOST" \
  --port "$PORT" \
  --fork-url "$BASE_RPC_URL" \
  --fork-block-number "$BASE_FORK_BLOCK_NUMBER" \
  --chain-id 8453 \
  --hardfork prague \
  --block-time "${FORK_BLOCK_TIME:-1}"
