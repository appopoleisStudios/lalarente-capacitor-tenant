#!/bin/bash
# Vendor Payment FULL SUITE — end-to-end E2E (Plane #64)
# Orchestrates the complete Tenant→Vendor money path coverage:
#   1. Seed the APPROVED tenant-payer invoice (happy-path prerequisite).
#   2. Seed the APPROVED OWNER-role invoice (payer-exclusivity negative).
#   3. Run the Maestro UI flow (vendor-payment-full-suite) — happy path +
#      payer-exclusivity assertion at the UI level.
#   4. Run the deterministic scenario verifier
#      (verify-vendor-payment-scenarios.mjs) — failure→retry, cancellation,
#      closure timeout, dispute, payout failure→retry, payer exclusivity
#      (API level) — all through the REAL edge functions.
#
# Usage:
#   bash scripts/run-vendor-payment-full-suite.sh
#
# Requires: .maestro/.env (credentials) + PAYFAST_PASSPHRASE for the ITN steps.
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
echo " VENDOR PAYMENT FULL SUITE (Plane #64)"
echo "════════════════════════════════════════════════════"

# ── Step 1: seed the APPROVED tenant-payer invoice ──
echo ""
echo "── 1/4 SEED APPROVED TENANT INVOICE ──"
node "$ROOT/scripts/seed-tenant-vendor-invoice.mjs"

# ── Step 2: seed the APPROVED OWNER-role invoice ──
echo ""
echo "── 2/4 SEED OWNER-ROLE INVOICE (payer exclusivity) ──"
node "$ROOT/scripts/seed-owner-role-invoice.mjs"

# ── Step 3: Maestro UI flow ──
echo ""
echo "── 3/4 MAESTRO UI FLOW (vendor-payment-full-suite) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/vendor-payment-full-suite.yaml"

# ── Step 4: deterministic scenario verification ──
echo ""
echo "── 4/4 VERIFY DETERMINISTIC SCENARIOS (real edge functions) ──"
node "$ROOT/scripts/verify-vendor-payment-scenarios.mjs"

echo ""
echo "✅ VENDOR PAYMENT FULL SUITE PASSED (seed ×2 → UI → deterministic scenarios)"
