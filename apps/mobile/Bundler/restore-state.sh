#!/bin/bash
# Restore Anvil state from file
if [ -f "anvil-state.json" ]; then
  echo "🔄 Restoring Anvil state..."
  cast rpc anvil_loadState "$(cat anvil-state.json)"
  echo "✅ State restored!"
else
  echo "⚠️  No saved state found"
fi
