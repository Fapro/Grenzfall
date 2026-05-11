#!/usr/bin/env bash
set -euo pipefail

# Start both backend and frontend (Expo)

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[roar-start] Starting Roar backend and frontend..."

# Start backend in background
echo "[roar-start] Starting backend..."
(cd "$PROJECT_ROOT/backend" && npm run dev) &
BACKEND_PID=$!

# Give backend time to start
sleep 2

# Start frontend with tunnel mode (or LAN fallback)
echo "[roar-start] Starting frontend with Expo..."
(cd "$PROJECT_ROOT" && bash scripts/start-expo-stable.sh tunnel) &
FRONTEND_PID=$!

# Store PIDs in temp file for stop script
mkdir -p "$PROJECT_ROOT/.pids"
echo "$BACKEND_PID" > "$PROJECT_ROOT/.pids/backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_ROOT/.pids/frontend.pid"

echo "[roar-start] ✓ Backend PID: $BACKEND_PID"
echo "[roar-start] ✓ Frontend PID: $FRONTEND_PID"
echo "[roar-start] Running. Press Ctrl+C to stop or run: bash scripts/stop.sh"

# Wait for both processes
wait
