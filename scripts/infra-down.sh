#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$ROOT_DIR/apps/backend/supabase"
PID_FILE="$SUPABASE_DIR/.temp/functions-serve.pid"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "[infra-down] stopping functions serve pid=$pid"
    kill "$pid" || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

echo "[infra-down] stopping local Supabase stack..."
npx supabase stop --workdir "$SUPABASE_DIR"
echo "[infra-down] done"
