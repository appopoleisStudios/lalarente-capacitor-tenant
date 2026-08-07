#!/bin/bash
# Owner Closure Review → Approve → Forward (Plane #77) — end-to-end E2E.
# Orchestrates the owner→tenant closure handoff:
#   1. Seed deterministic pending-closure state (vendor assigned → request
#      in_progress + closure_requested_at + pending closure report) via
#      seed-owner-closure-forward.mjs.
#   2. Maestro UI flow: owner review-closure → Approve → Forward primary CTA →
#      Awaiting Tenant Verification.
#   3. Maestro UI flow: tenant verify screen ErrorState+retry on an incomplete
#      deep link (no crash on missing requestId / bad JSON).
#
# This is what the suite runners invoke (run-e2e-individual.sh,
# run-full-e2e-suite.sh) so the #77 screens are covered in the suite.
#
# Usage:
#   bash scripts/run-owner-closure-forward-e2e.sh
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
echo " OWNER CLOSURE FORWARD (Plane #77)"
echo "════════════════════════════════════════════════════"

# ── Step 1: seed deterministic closure-review state ──
echo ""
echo "── 1/3 SEED CLOSURE STATE ──"
SEED_OUTPUT="$(node "$ROOT/scripts/seed-owner-closure-forward.mjs" 2>&1)"
echo "$SEED_OUTPUT"
MR_ID="$(echo "$SEED_OUTPUT" | grep -oE 'SEED_MR_ID=[a-f0-9-]+' | head -1 | cut -d= -f2)"
if [[ -z "$MR_ID" ]]; then
  echo "ERROR: seed did not emit SEED_MR_ID"
  exit 1
fi
echo "MR_ID=$MR_ID"

# ── Step 2: owner review → approve → forward UI flow ──
echo ""
echo "── 2/3 MAESTRO UI FLOW (owner-closure-forward) ──"
"$MAESTRO_BIN" test \
  --env OWNER_EMAIL="$OWNER_EMAIL" \
  --env OWNER_PASSWORD="$OWNER_PASSWORD" \
  --env MR_ID="$MR_ID" \
  "$ROOT/.maestro/flows/owner-closure-forward.yaml"

# ── Step 3: tenant verify ErrorState+retry (incomplete deep link) ──
echo ""
echo "── 3/3 MAESTRO UI FLOW (tenant-verify-error) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/tenant-verify-error.yaml"

echo ""
echo "✅ OWNER CLOSURE FORWARD E2E PASSED (seed → approve → forward → tenant error state)"
