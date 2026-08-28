#!/bin/bash
# Owner → vendor payment (LAL-116 / LAL-112 follow-up)
#   1. Seed APPROVED owner-payer invoice (OWNER_PAY_E2E=1 retitles job).
#   2. Maestro UI: owner invoice → Pay via PayFast → in-app checkout.
#   3. verify-owner-payment-completed.mjs: owner JWT checkout, tenant 403,
#      signed COMPLETE ITN, invoice paid, vendor_payments completed.
#
# SKIP_MAESTRO=1 runs seed + money-path verify only (no simulator).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.maestro/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

for var in TENANT_EMAIL TENANT_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD OWNER_EMAIL OWNER_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Set $var in .maestro/.env"
    exit 1
  fi
done

echo ""
echo "════════════════════════════════════════════════════"
echo " OWNER → VENDOR PAYMENT (LAL-116)"
echo "════════════════════════════════════════════════════"

echo ""
echo "── 1/3 SEED APPROVED OWNER-PAYER INVOICE ──"
OWNER_PAY_E2E=1 node "$ROOT/scripts/seed-owner-role-invoice.mjs"

if [[ "${SKIP_MAESTRO:-}" != "1" ]]; then
  source "$SCRIPT_DIR/lib/resolve-maestro.sh"
  echo ""
  echo "── 2/3 MAESTRO UI FLOW (owner-invoice-pay) ──"
  "$MAESTRO_BIN" test \
    --env OWNER_EMAIL="$OWNER_EMAIL" \
    --env OWNER_PASSWORD="$OWNER_PASSWORD" \
    "$ROOT/.maestro/flows/owner-invoice-pay.yaml"
else
  echo ""
  echo "── 2/3 MAESTRO SKIPPED (SKIP_MAESTRO=1) ──"
fi

echo ""
echo "── 3/3 VERIFY owner checkout + completed vendor_payments ──"
node "$ROOT/scripts/verify-owner-payment-completed.mjs"

echo ""
echo "✅ OWNER → VENDOR PAYMENT PASSED"
