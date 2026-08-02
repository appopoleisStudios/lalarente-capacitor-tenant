#!/bin/bash
# Tenant Payment Happy Path — end-to-end E2E (Plane #60)
# Orchestrates the FULL money path smoke:
#   1. Seed the APPROVED tenant-payer invoice (prerequisite for the UI flow).
#   2. Run the Maestro UI flow (login → invoice → breakdown → Pay via PayFast →
#      in-app Secure Checkout) — verifies the tenant can reach the gateway.
#   3. Verify record completion deterministically: creates the checkout via the
#      real edge function, drives a signed COMPLETE ITN through the real
#      payment-webhook, polls get-vendor-payment-status and asserts the
#      vendor_payments record reached 'completed'.
#
# This is what the runners invoke (run-e2e-individual.sh, run-full-e2e-suite.sh)
# so record completion is wired into the suite — not a manual follow-up.
#
# Usage:
#   bash scripts/run-tenant-payment-e2e.sh
#
# Requires: .maestro/.env (credentials) + PAYFAST_PASSPHRASE for the ITN step.
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
echo " TENANT PAYMENT HAPPY PATH (Plane #60)"
echo "════════════════════════════════════════════════════"

# ── Step 1: seed the APPROVED tenant-payer invoice ──
echo ""
echo "── 1/3 SEED APPROVED TENANT INVOICE ──"
node "$ROOT/scripts/seed-tenant-vendor-invoice.mjs"

# ── Step 2: Maestro UI flow ──
echo ""
echo "── 2/3 MAESTRO UI FLOW (vendor-payment-flow) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/vendor-payment-flow.yaml"

# ── Step 3: deterministic record completion + verification ──
echo ""
echo "── 3/3 VERIFY vendor_payments RECORD COMPLETED ──"
node "$ROOT/scripts/verify-tenant-payment-completed.mjs"

echo ""
echo "✅ TENANT PAYMENT HAPPY PATH PASSED (seed → UI → completed record)"
