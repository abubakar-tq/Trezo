#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
SUPABASE_DIR="$BACKEND_DIR/supabase"
PID_FILE="$SUPABASE_DIR/.temp/functions-serve.pid"
RUNTIME_ENV_FILE="$SUPABASE_DIR/.temp/functions-runtime.env"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "[infra-down] stopping functions serve pid=$pid"
    kill "$pid" || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

rm -f "$RUNTIME_ENV_FILE"
echo "[infra-down] removed generated functions runtime env"

echo "[infra-down] stopping local Supabase stack..."
npx supabase stop --workdir "$BACKEND_DIR"
echo "[infra-down] done"
