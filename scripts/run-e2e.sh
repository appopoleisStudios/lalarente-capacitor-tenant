#!/usr/bin/env bash
# Run visible UI tests on iOS Simulator or Android emulator via Maestro.
# You watch the device while Maestro taps buttons and types text — like a human.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.maestro/.env"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro is not installed."
  echo ""
  echo "Install (macOS/Linux):"
  echo "  curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  echo ""
  echo "Then re-run: npm run test:e2e"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy .maestro/.env.example → .maestro/.env and add QA login credentials."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

for var in TENANT_EMAIL TENANT_PASSWORD OWNER_EMAIL OWNER_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set $var in .maestro/.env"
    exit 1
  fi
done

cd "$ROOT"

FLOW="${1:-.maestro/flows}"
echo "▶ Maestro UI tests — watch your simulator/emulator"
echo "  Flows: $FLOW"
echo ""

maestro test "$FLOW" \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  --env OWNER_EMAIL="$OWNER_EMAIL" \
  --env OWNER_PASSWORD="$OWNER_PASSWORD"
