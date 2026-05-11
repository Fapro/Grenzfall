#!/usr/bin/env bash
set -euo pipefail

# Stop both backend and frontend

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

echo "[roar-stop] Stopping Roar..."

# Kill processes by PID if they exist
if [[ -f "$PID_DIR/backend.pid" ]]; then
  BACKEND_PID=$(cat "$PID_DIR/backend.pid")
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[roar-stop] Killing backend (PID: $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  rm -f "$PID_DIR/backend.pid"
fi

if [[ -f "$PID_DIR/frontend.pid" ]]; then
  FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
  if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[roar-stop] Killing frontend (PID: $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  rm -f "$PID_DIR/frontend.pid"
fi

# Fallback: kill by process name
echo "[roar-stop] Cleaning up stray processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "@expo/cli" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true

# Clean up .pids directory
rmdir "$PID_DIR" 2>/dev/null || true

echo "[roar-stop] ✓ Stopped"
