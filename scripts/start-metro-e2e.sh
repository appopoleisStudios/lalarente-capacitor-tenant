#!/usr/bin/env bash
# Start Metro with Supabase/.env loaded (required for Maestro login on Mac mini).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.nvm/versions/node/v24.4.1/bin:${HOME}/.maestro/bin:/opt/homebrew/bin:${PATH:-}"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env — copy from Doppler or .env.example"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ROOT/.env"
set +a

pkill -f "expo start" 2>/dev/null || true
pkill -f "node.*metro" 2>/dev/null || true
sleep 3

echo "Starting Metro with .env loaded ($(date))"
exec npx expo start "$@"
