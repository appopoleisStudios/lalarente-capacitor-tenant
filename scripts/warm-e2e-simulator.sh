#!/usr/bin/env bash
# Warm Metro JS bundle on the simulator before Maestro clearState login loops.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
  echo "Metro not running — start: bash scripts/start-metro-e2e.sh"
  exit 1
fi

echo "▶ Pre-warming simulator bundle from Metro…"
xcrun simctl terminate booted com.lalarente.app 2>/dev/null || true
sleep 2
xcrun simctl launch booted com.lalarente.app >/dev/null
sleep 20
xcrun simctl terminate booted com.lalarente.app 2>/dev/null || true
sleep 2
echo "▶ Bundle warm-up done"
