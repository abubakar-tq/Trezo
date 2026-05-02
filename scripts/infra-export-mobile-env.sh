#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <INFRA_LAPTOP_IP>"
  exit 1
fi

INFRA_IP="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$ROOT_DIR/apps/backend/supabase"
OUTPUT_FILE="$SUPABASE_DIR/.temp/mobile-remote.env"

status_env="$(npx supabase status -o env --workdir "$SUPABASE_DIR")"
anon_key="$(printf '%s\n' "$status_env" | awk -F= '/^ANON_KEY=/{print substr($0,10)}')"

if [[ -z "$anon_key" ]]; then
  echo "Failed to read ANON_KEY from local Supabase status."
  echo "Run local stack first: npm run supabase:local:start"
  exit 1
fi

cat > "$OUTPUT_FILE" <<EOF
# Copy these lines into apps/mobile/.env on your coding laptop.
EXPO_PUBLIC_SUPABASE_OVERRIDE_URL=http://$INFRA_IP:54321
EXPO_PUBLIC_SUPABASE_OVERRIDE_ANON_KEY=$anon_key
EXPO_PUBLIC_ANVIL_RPC_URL=http://$INFRA_IP:8545
EXPO_PUBLIC_LAPTOP_IP=$INFRA_IP
EOF

echo "Wrote $OUTPUT_FILE"
