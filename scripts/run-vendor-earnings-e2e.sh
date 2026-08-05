#!/bin/bash
# Vendor Earnings + Banking — end-to-end E2E (Plane #52)
# Orchestrates the earnings/banking happy path:
#   1. Seed deterministic payout preferences via the REAL
#      save-vendor-payout-preferences edge function (idempotent upsert).
#   2. Run the Maestro UI flow (login → earnings dashboard → banking screen
#      → radio-tap schedule change → save → verify persisted).
#
# This is what the suite runners invoke (run-e2e-individual.sh,
# run-full-e2e-suite.sh) so the earnings/banking screens are covered in the
# suite — mirroring the payment/closure orchestrator wiring.
#
# Usage:
#   bash scripts/run-vendor-earnings-e2e.sh
#
# Requires: .maestro/.env (TENANT/VENDOR/OWNER credentials).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── source credentials ──
ENV_FILE="$ROOT/.maestro/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found — copy .maestro/.env.example and fill credentials"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

for var in TENANT_EMAIL TENANT_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD OWNER_EMAIL OWNER_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Set $var in .maestro/.env"
    exit 1
  fi
done

# ── resolve maestro CLI ──
source "$SCRIPT_DIR/lib/resolve-maestro.sh"

echo ""
echo "════════════════════════════════════════════════════"
echo " VENDOR EARNINGS + BANKING (Plane #52)"
echo "════════════════════════════════════════════════════"

# ── Step 1: seed deterministic payout preferences ──
echo ""
echo "── 1/2 SEED PAYOUT PREFERENCES ──"
node "$ROOT/scripts/seed-vendor-banking.mjs"

# ── Step 2: Maestro UI flow ──
echo ""
echo "── 2/2 MAESTRO UI FLOW (22-pr52-vendor-earnings-banking) ──"
"$MAESTRO_BIN" test \
  --env VENDOR_EMAIL="$VENDOR_EMAIL" \
  --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
  "$ROOT/.maestro/flows/22-pr52-vendor-earnings-banking.yaml"

echo ""
echo "✅ VENDOR EARNINGS E2E PASSED (seed → earnings dashboard → banking → save)"
