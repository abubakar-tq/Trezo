#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$ROOT_DIR/apps/backend/supabase"
TEMP_DIR="$SUPABASE_DIR/.temp"
FUNCTIONS_LOG="$TEMP_DIR/functions-serve.log"
FUNCTIONS_PID_FILE="$TEMP_DIR/functions-serve.pid"
FUNCTIONS_ENV_FILE="$SUPABASE_DIR/functions/.env.local"
SYNC_ENV_FILE="$SUPABASE_DIR/.env.sync.local"

mkdir -p "$TEMP_DIR"

echo "[infra-up] Starting local Supabase stack..."
npx supabase start --workdir "$SUPABASE_DIR"

status_env="$(npx supabase status -o env --workdir "$SUPABASE_DIR")"
local_api_url="$(printf '%s\n' "$status_env" | awk -F= '/^API_URL=/{print substr($0,9)}')"
local_service_key="$(printf '%s\n' "$status_env" | awk -F= '/^SERVICE_ROLE_KEY=/{print substr($0,18)}')"

if [[ -f "$SYNC_ENV_FILE" ]]; then
  echo "[infra-up] Found sync config: $SYNC_ENV_FILE"
  # shellcheck disable=SC1090
  source "$SYNC_ENV_FILE"

  if [[ -n "${REMOTE_SUPABASE_URL:-}" && -n "${REMOTE_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "[infra-up] Syncing user data from remote project..."
    REMOTE_SUPABASE_URL="$REMOTE_SUPABASE_URL" \
    REMOTE_SUPABASE_SERVICE_ROLE_KEY="$REMOTE_SUPABASE_SERVICE_ROLE_KEY" \
    SYNC_USER_EMAIL="${SYNC_USER_EMAIL:-}" \
    SYNC_USER_ID="${SYNC_USER_ID:-}" \
    LOCAL_SUPABASE_URL="$local_api_url" \
    LOCAL_SUPABASE_SERVICE_ROLE_KEY="$local_service_key" \
    node "$ROOT_DIR/scripts/supabase-sync-user.js"
  else
    echo "[infra-up] Sync file exists but remote credentials are missing; skipping sync."
  fi
else
  echo "[infra-up] No sync config found. Skipping remote data sync."
fi

if [[ ! -f "$FUNCTIONS_ENV_FILE" ]]; then
  echo "[infra-up] Missing $FUNCTIONS_ENV_FILE"
  echo "[infra-up] Copy example and fill secrets:"
  echo "           cp $SUPABASE_DIR/functions/.env.local.example $FUNCTIONS_ENV_FILE"
  exit 1
fi

if [[ -f "$FUNCTIONS_PID_FILE" ]]; then
  old_pid="$(cat "$FUNCTIONS_PID_FILE" || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
    echo "[infra-up] functions serve already running (pid=$old_pid)"
    echo "[infra-up] done"
    exit 0
  fi
  rm -f "$FUNCTIONS_PID_FILE"
fi

echo "[infra-up] Starting functions serve in background..."
nohup npx supabase functions serve \
  --workdir "$SUPABASE_DIR" \
  --env-file "$FUNCTIONS_ENV_FILE" \
  --no-verify-jwt >"$FUNCTIONS_LOG" 2>&1 &

new_pid="$!"
echo "$new_pid" >"$FUNCTIONS_PID_FILE"
sleep 1

if kill -0 "$new_pid" >/dev/null 2>&1; then
  echo "[infra-up] functions serve started (pid=$new_pid)"
  echo "[infra-up] log: $FUNCTIONS_LOG"
else
  echo "[infra-up] failed to start functions serve. Check log: $FUNCTIONS_LOG"
  exit 1
fi

echo "[infra-up] done"
