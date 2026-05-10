#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-tunnel}"

# Clean stale Expo/Metro processes that can create port storms and memory pressure.
pkill -f "expo start" 2>/dev/null || true
pkill -f "@expo/cli" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# Give Node more headroom to avoid zsh: killed / exit 137 during Metro startup.
export NODE_OPTIONS="--max-old-space-size=6144"
export EXPO_NO_TELEMETRY=1

case "$MODE" in
  tunnel)
    echo "[expo-stable] Trying tunnel mode..."
    if ! npx expo start --tunnel -c; then
      echo "[expo-stable] Tunnel failed. Falling back to LAN mode..."
      exec npx expo start --lan -c
    fi
    ;;
  web)
    exec npx expo start --web -c
    ;;
  lan)
    exec npx expo start --lan -c
    ;;
  *)
    echo "Usage: ./scripts/start-expo-stable.sh [tunnel|web|lan]"
    exit 1
    ;;
esac
