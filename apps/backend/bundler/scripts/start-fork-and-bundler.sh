#!/usr/bin/env bash
set -euo pipefail

# start-fork-and-bundler.sh
# Runs the Base fork startup script and then brings up the bundler docker compose.
# Usage:
#   ./start-fork-and-bundler.sh        # runs fork script, then docker compose up -d
#   ./start-fork-and-bundler.sh --fg   # runs docker compose in foreground (no -d)

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# Directory of the bundler (one level up from this scripts/ dir)
BUNDLER_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

FG=false
if [ "${1:-}" = "--fg" ] || [ "${1:-}" = "--foreground" ]; then
  FG=true
fi
REPO_ROOT=$(cd "$BUNDLER_DIR/../../.." && pwd)
ENVFILE="$REPO_ROOT/.env.local"

if [ -f "$ENVFILE" ]; then
  echo "[trezo] Sourcing environment file: $ENVFILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENVFILE"
  set +a
fi

echo "[trezo] Starting Base fork (via scripts/start-base-fork.sh)"
if [ -z "${BASE_RPC_URL:-}" ] || [ -z "${BASE_FORK_BLOCK_NUMBER:-}" ]; then
  echo "Error: BASE_RPC_URL and BASE_FORK_BLOCK_NUMBER are required but not set." >&2
  echo "Create $ENVFILE with those values or export them in your shell, then retry." >&2
  exit 2
fi
cd "$BUNDLER_DIR"

if [ ! -x ./scripts/start-base-fork.sh ]; then
  echo "Error: ./scripts/start-base-fork.sh not found or not executable" >&2
  exit 2
fi

# start-base-fork.sh ends with `exec anvil ...`, so it never returns. Run it in
# the background so this script can also bring up the bundler.
ANVIL_LOG="/tmp/trezo-anvil-fork.log"
echo "[trezo] Starting Base fork in background (logs: $ANVIL_LOG)"
nohup ./scripts/start-base-fork.sh > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
echo "[trezo] Anvil PID: $ANVIL_PID"

ANVIL_RPC_PROBE="http://localhost:${FORK_PORT:-8545}"
echo "[trezo] Waiting for anvil to accept RPC at $ANVIL_RPC_PROBE ..."
ANVIL_READY=false
for _ in $(seq 1 30); do
  if curl -s -m 1 -X POST "$ANVIL_RPC_PROBE" \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
      | grep -q '"result"'; then
    ANVIL_READY=true
    break
  fi
  sleep 1
done
if [ "$ANVIL_READY" != "true" ]; then
  echo "[trezo] anvil never became ready — see $ANVIL_LOG" >&2
  kill "$ANVIL_PID" 2>/dev/null || true
  exit 3
fi
echo "[trezo] anvil is ready"

echo "[trezo] Starting bundler docker compose"
if [ "$FG" = true ]; then
  # Foreground mode: kill anvil when the bundler exits (Ctrl+C, etc.)
  trap 'echo "[trezo] Stopping anvil ($ANVIL_PID)"; kill "$ANVIL_PID" 2>/dev/null || true' EXIT INT TERM
  docker compose -f docker-compose.fork.yml up
else
  docker compose -f docker-compose.fork.yml up -d
  # Detach anvil so it survives this script exiting.
  disown "$ANVIL_PID" 2>/dev/null || true
  echo "[trezo] Bundler started (detached)."
  echo "[trezo] Bundler logs: docker compose -f $BUNDLER_DIR/docker-compose.fork.yml logs -f"
  echo "[trezo] Anvil logs:   tail -f $ANVIL_LOG"
  echo "[trezo] Stop anvil with: kill $ANVIL_PID"
fi

echo "[trezo] Done"
/