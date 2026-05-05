#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_NODE_MODULES="$ROOT_DIR/contracts/node_modules"
ROOT_NODE_MODULES="$ROOT_DIR/node_modules"

mkdir -p "$CONTRACTS_NODE_MODULES"

ZK_LINK="$CONTRACTS_NODE_MODULES/@zk-email"
SS_LINK="$CONTRACTS_NODE_MODULES/solidity-stringutils"

# @zk-email: contracts has its own package-lock.json so npm does not hoist its deps to root.
# Prefer a root-hoisted copy if it ever appears; otherwise preserve the local install from
# `cd contracts && npm ci`. Never replace a working local install with a broken symlink.
if [ -d "$ROOT_NODE_MODULES/@zk-email/ether-email-auth-contracts" ]; then
    # Root has it — replace whatever is in contracts with a symlink
    rm -rf "$ZK_LINK"
    ln -s "$ROOT_NODE_MODULES/@zk-email" "$ZK_LINK"
elif [ -L "$ZK_LINK" ] && [ ! -d "$ZK_LINK/ether-email-auth-contracts" ]; then
    # Broken symlink left from a previous npm install — remove it
    rm -f "$ZK_LINK"
    echo "WARNING: @zk-email/ether-email-auth-contracts is missing. Run: cd contracts && npm ci" >&2
fi
# If contracts/node_modules/@zk-email is a real directory with the package, leave it alone.

# solidity-stringutils is hoisted to root by npm workspaces — always link it
rm -rf "$SS_LINK"
ln -s "$ROOT_NODE_MODULES/solidity-stringutils" "$SS_LINK"
