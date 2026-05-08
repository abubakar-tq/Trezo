#!/usr/bin/env bash
# scripts/fork/fund-bundler.sh
#
# Fund the Alto ERC-4337 bundler executor on the Base mainnet fork so it can
# relay UserOperations.  Alto uses Anvil key #0 by default.
#
# Required env:
#   FORK_RPC_URL   - e.g. http://192.168.100.68:8545
#
# Optional env:
#   ALTO_EXECUTOR  - executor address (default: Anvil key #0)
#   FUND_ETH       - amount of ETH to set (default: 10)

set -euo pipefail

: "${FORK_RPC_URL:?Set FORK_RPC_URL (e.g. http://192.168.100.68:8545)}"

ALTO_EXECUTOR="${ALTO_EXECUTOR:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
FUND_ETH="${FUND_ETH:-10}"

if ! command -v cast &>/dev/null; then
  echo "❌ 'cast' not found. Install Foundry: https://getfoundry.sh"
  exit 1
fi

CHAIN_ID=$(cast chain-id --rpc-url "$FORK_RPC_URL")
if [ "$CHAIN_ID" != "8453" ]; then
  echo "❌ Chain ID is $CHAIN_ID, expected 8453. Is the Base fork running?"
  exit 1
fi

WEI_HEX=$(python3 -c "print(hex(int(float('$FUND_ETH') * 10**18)))")

echo "⟳  Setting Alto executor balance to $FUND_ETH ETH..."
cast rpc anvil_setBalance "$ALTO_EXECUTOR" "$WEI_HEX" --rpc-url "$FORK_RPC_URL"

BALANCE=$(cast balance "$ALTO_EXECUTOR" --rpc-url "$FORK_RPC_URL" --ether)
echo "✅ Alto executor $ALTO_EXECUTOR: $BALANCE ETH"
