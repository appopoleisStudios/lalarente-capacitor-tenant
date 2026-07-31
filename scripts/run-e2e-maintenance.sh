#!/bin/bash
# ============================================================================
# E2E Maintenance Flow: Tenant creates → Vendor sees → Vendor quotes
#
# Runs the consolidated .maestro/flows/e2e-tenant-create-vendor-quote.yaml,
# which requires a UNIQUE REQUEST_TITLE per run (timestamp suffix only — no
# regex-special chars) so repeated runs don't create multiple matching rows in
# the vendor list. This script auto-generates one, so the flow can never be
# invoked without it.
#
# Usage: bash scripts/run-e2e-maintenance.sh
#
# Prerequisites:
#   - iOS Simulator running with the app installed (dev build)
#   - Metro bundler running (npx expo start) on :8081
#   - e2e-vendor@lalarente.com has Plumbing & Electrical services
#   - navin.indraj@yahoo.com (tenant) has an active lease
#   - DB migrations applied (maintenance_requests visibility, quotes tables)
#   - This is a device smoke test, not a CI gate: each run creates real rows
#     on the LalaRente Supabase project. Clean up e2e requests periodically.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO="$HOME/.maestro/bin/maestro"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=180000

# ── source credentials (single source of truth: .maestro/.env) ──
ENV_FILE="$APP_DIR/.maestro/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found — copy .maestro/.env.example and fill credentials"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

for var in TENANT_EMAIL TENANT_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Set $var in .maestro/.env"
    exit 1
  fi
done

# Unique title per run — timestamp suffix keeps it regex-safe and avoids
# multi-match ambiguity in the vendor request list.
REQ_TITLE="E2E Test - Leaking $(date +%s)"
echo "Request title: $REQ_TITLE"

echo "=========================================="
echo "🧪 E2E: Tenant creates → Vendor quotes"
echo "=========================================="
cd "$APP_DIR"
"$MAESTRO" test .maestro/flows/e2e-tenant-create-vendor-quote.yaml \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  --env VENDOR_EMAIL="$VENDOR_EMAIL" \
  --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
  --env REQUEST_TITLE="$REQ_TITLE" 2>&1 | tail -40

echo ""
echo "=========================================="
echo "✅ E2E Maintenance Flow Complete!"
echo "=========================================="
