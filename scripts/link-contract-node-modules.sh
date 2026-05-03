#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_NODE_MODULES="$ROOT_DIR/contracts/node_modules"
ROOT_NODE_MODULES="$ROOT_DIR/node_modules"

mkdir -p "$CONTRACTS_NODE_MODULES" "$CONTRACTS_NODE_MODULES/@zk-email"

rm -rf "$CONTRACTS_NODE_MODULES/@zk-email" "$CONTRACTS_NODE_MODULES/solidity-stringutils"

ln -s "$ROOT_NODE_MODULES/@zk-email" "$CONTRACTS_NODE_MODULES/@zk-email"
ln -s "$ROOT_NODE_MODULES/solidity-stringutils" "$CONTRACTS_NODE_MODULES/solidity-stringutils"
