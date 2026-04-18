#!/bin/bash
# Save Anvil state to file
echo "📸 Saving Anvil state..."
cast rpc anvil_dumpState > anvil-state.json
echo "✅ State saved to anvil-state.json"
