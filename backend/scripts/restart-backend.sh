#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Usage:
#   ./scripts/restart-backend.sh
#   ./scripts/restart-backend.sh --with-web-ports
#   ./scripts/restart-backend.sh 3001 8081 8082 8083
#   ./scripts/restart-backend.sh --kill-only 3001

KILL_ONLY=false
WITH_WEB_PORTS=false
PORTS=()

for arg in "$@"; do
  if [[ "$arg" == "--kill-only" ]]; then
    KILL_ONLY=true
  elif [[ "$arg" == "--with-web-ports" ]]; then
    WITH_WEB_PORTS=true
  else
    PORTS+=("$arg")
  fi
done

if [[ ${#PORTS[@]} -eq 0 ]]; then
  BACKEND_PORT="${PORT:-3001}"
  PORTS=("$BACKEND_PORT")
  if [[ "$WITH_WEB_PORTS" == "true" ]]; then
    PORTS+=("8081" "8082" "8083")
  fi
fi

echo "[restart-backend] Checking ports: ${PORTS[*]}"

for port in "${PORTS[@]}"; do
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    echo "[restart-backend] Skipping invalid port: $port"
    continue
  fi

  # Only target listeners to avoid killing random client processes.
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  if [[ -n "$pids" ]]; then
    echo "[restart-backend] Killing processes on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  else
    echo "[restart-backend] Port $port is free"
  fi
done

if [[ "$KILL_ONLY" == "true" ]]; then
  echo "[restart-backend] Kill-only mode complete"
  exit 0
fi

echo "[restart-backend] Starting backend dev server..."
cd "$BACKEND_DIR"
npm run dev
