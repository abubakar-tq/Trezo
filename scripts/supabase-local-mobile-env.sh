#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$ROOT_DIR/apps/backend/supabase"
OUTPUT_ENV="$ROOT_DIR/apps/mobile/.env.local.supabase"

status_env="$(npx supabase status -o env --workdir "$SUPABASE_DIR")"

api_url="$(printf '%s\n' "$status_env" | awk -F= '/^API_URL=/{print substr($0,9)}')"
anon_key="$(printf '%s\n' "$status_env" | awk -F= '/^ANON_KEY=/{print substr($0,10)}')"

if [[ -z "$api_url" || -z "$anon_key" ]]; then
  echo "Failed to read API_URL/ANON_KEY from local Supabase status."
  echo "Run local Supabase first: npm run supabase:local:start"
  exit 1
fi

cat > "$OUTPUT_ENV" <<EOF
# Generated from local Supabase status. Keep this file local-only.
EXPO_PUBLIC_SUPABASE_OVERRIDE_URL=$api_url
EXPO_PUBLIC_SUPABASE_OVERRIDE_ANON_KEY=$anon_key
EOF

echo "Wrote $OUTPUT_ENV"
echo "Merge these override values into apps/mobile/.env before running Expo."
