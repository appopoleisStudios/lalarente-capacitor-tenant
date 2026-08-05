#!/bin/bash
# Lalarente — FULL E2E Test Suite
# Runs ALL flows for ALL profiles: Tenant → Owner → Vendor
# Clears app state between each phase (fresh install) so cached sessions don't interfere.
# Reports PASS/FAIL for every flow with timing.

# ────────────────────────────────────────────────────
# Usage:
#   source .maestro/.env
#   bash scripts/run-full-e2e-suite.sh
# ────────────────────────────────────────────────────

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

for var in TENANT_EMAIL TENANT_PASSWORD OWNER_EMAIL OWNER_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Set $var in .maestro/.env"
    exit 1
  fi
done

# ── resolve maestro ──
source "$SCRIPT_DIR/lib/resolve-maestro.sh"

RESULTS_FILE="/tmp/lalarente-e2e-$(date +%s).txt"
> "$RESULTS_FILE"

# ────────────────────────────────────────────────────
# ALL FLOWS BY ROLE
# ────────────────────────────────────────────────────

TENANT_FLOWS=(
  # Core tenant flows
  "01-tenant-dashboard"
  "02-tenant-lala-ai"
  "03-tenant-maintenance"
  "05-pr7-tenant-tenancy-shortcuts"
  "06-pr7-tenant-disputes-empty"
  "07-pr7-tenant-application-pdf"
  "08-pr9-tenant-inspections"
  "11-pr10-tenant-maintenance-message"
  "12-pr10-tenant-messaging-keyboard"
  "13-pr10-tenant-lease-pdf"
  "14-pr10-tenant-maintenance-camera"
  "17-pr11-tenant-viewings-applications"
  # Client feedback tenant flows
  "client-feedback/s2-25-tenant-bell"
  "client-feedback/s2-26-tenant-profile-docs"
  "client-feedback/s2-31-tenant-contact-owner"
  "client-feedback/s2-32-tenant-payments"
  "client-feedback/s2-40-tenant-send-message"
)

# ── Tenant Payment Happy Path (Plane #60) ──
# Runs OUTSIDE the tenant array: the orchestrator seeds the invoice, runs the
# Maestro UI flow (vendor-payment-flow), then verifies the vendor_payments
# record reached 'completed'. Wired here so record completion is part of the
# suite, not a manual follow-up. Replaces the legacy 20-vendor-payments smoke.

OWNER_FLOWS=(
  # Core owner flows
  "04-owner-dashboard"
  "09-pr9-owner-inspection-conduct"
  "10-pr9-owner-inspection-readonly"
  "15-pr7-owner-disputes-empty"
  "16-pr6-owner-lala-ai"
  "18-pr11-owner-applications"
  # Client feedback owner flows
  "client-feedback/s2-01-owner-dashboard"
  "client-feedback/s2-02-owner-bell"
  "client-feedback/s2-03-owner-viewings"
  "client-feedback/s2-08-owner-leases"
  "client-feedback/s2-10-owner-lease-messages"
  "client-feedback/s2-11-owner-rent-roll"
  "client-feedback/s2-13-owner-maintenance"
  "client-feedback/s2-19-owner-messages"
  "client-feedback/s2-21-owner-property"
)

VENDOR_FLOWS=(
  # Vendor parity flows
  "vendor-dashboard"
  "vendor-notifications"
  "vendor-messaging"
  "vendor-maintenance"
  "vendor-ai-chat"
)

# ── helpers ──

PASSED=0
FAILED=0

run_flow() {
  local flow="$1"
  shift
  local label="${flow#client-feedback/}"  # strip prefix for cleaner display
  echo "  ▶ $label..."
  START=$(date +%s)
  set +e
  "$MAESTRO_BIN" test "$@" ".maestro/flows/$flow.yaml" 2>&1
  EC=$?
  set -e
  END=$(date +%s)
  DURATION=$((END - START))
  if [ "$EC" -eq 0 ]; then
    echo "    ✓ $label (${DURATION}s)" >> "$RESULTS_FILE"
    PASSED=$((PASSED + 1))
  else
    echo "    ✗ $label FAILED (${DURATION}s) — exit $EC" >> "$RESULTS_FILE"
    FAILED=$((FAILED + 1))
  fi
}

# ── sign out via Maestro subflow, then stop app ──
# This reliably clears the session without needing to reinstall the app.
sign_out_and_stop() {
  echo "  ── Signing out and stopping app ──"
  set +e
  "$MAESTRO_BIN" test ".maestro/subflows/sign-out.yaml" 2>&1
  local EC=$?
  set -e
  
  if [ "$EC" -ne 0 ]; then
    echo "  ⚠ Sign-out subflow failed ($EC) — this is expected if app was already uninstalled"
    echo "  Attempting to clear any cached state via terminate only..."
  fi
  
  xcrun simctl terminate booted com.lalarente.app 2>/dev/null || true
  echo "  App terminated. Next flow will attempt fresh start."
}

print_header() {
  local title="$1"
  local len=${#title}
  local pad=$(( (50 - len - 2) / 2 ))
  printf '═%.0s' {1..50}
  echo ""
  printf '%*s %s %*s\n' "$pad" '' "$title" "$pad" ''
  printf '═%.0s' {1..50}
  echo ""
}

# ════════════════════════════════════════════════════
#  PRE-FLIGHT: Sign out any cached session from previous testing
# ════════════════════════════════════════════════════
print_header "PRE-FLIGHT: CLEARING CACHED SESSION"
sign_out_and_stop

# ════════════════════════════════════════════════════
#  PHASE 1: TENANT
# ════════════════════════════════════════════════════
print_header "PHASE 1: TENANT (${#TENANT_FLOWS[@]} flows)"
for flow in "${TENANT_FLOWS[@]}"; do
  run_flow "$flow" \
    --env TENANT_EMAIL="$TENANT_EMAIL" \
    --env TENANT_PASSWORD="$TENANT_PASSWORD"
done

# ════════════════════════════════════════════════════
#  PHASE 1B: TENANT PAYMENT HAPPY PATH (seed → UI → verify)
# ════════════════════════════════════════════════════
print_header "TENANT PAYMENT HAPPY PATH (Plane #60)"
START=$(date +%s)
set +e
bash "$SCRIPT_DIR/run-tenant-payment-e2e.sh" 2>&1
EC=$?
set -e
END=$(date +%s)
DURATION=$((END - START))
if [ "$EC" -eq 0 ]; then
  echo "    ✓ Payment Happy Path (${DURATION}s)" >> "$RESULTS_FILE"
  PASSED=$((PASSED + 1))
else
  echo "    ✗ Payment Happy Path FAILED (${DURATION}s) — exit $EC" >> "$RESULTS_FILE"
  FAILED=$((FAILED + 1))
fi

# ════════════════════════════════════════════════════
#  PHASE 1C: VENDOR PAYMENT FULL SUITE (Plane #64)
#  seed tenant invoice → seed owner-role invoice → Maestro UI flow
#  (vendor-payment-full-suite: happy path + payer exclusivity) →
#  deterministic scenario verification (failure→retry, cancellation,
#  closure timeout, dispute, payout failure→retry, payer exclusivity)
#  through the REAL edge functions.
# ════════════════════════════════════════════════════
print_header "VENDOR PAYMENT FULL SUITE (Plane #64)"
START=$(date +%s)
set +e
bash "$SCRIPT_DIR/run-vendor-payment-full-suite.sh" 2>&1
EC=$?
set -e
END=$(date +%s)
DURATION=$((END - START))
if [ "$EC" -eq 0 ]; then
  echo "    ✓ Vendor Payment Full Suite (${DURATION}s)" >> "$RESULTS_FILE"
  PASSED=$((PASSED + 1))
else
  echo "    ✗ Vendor Payment Full Suite FAILED (${DURATION}s) — exit $EC" >> "$RESULTS_FILE"
  FAILED=$((FAILED + 1))
fi

# ════════════════════════════════════════════════════
#  PHASE 1D: TENANT CLOSURE CONFIRM + TIMELINE PHOTO (Plane #61/#62)
#  seed closure state → Maestro UI flow (closure-confirm screen, after-work
#  photos, timeline progress photo). Mirrors the payment-happy-path wiring.
# ════════════════════════════════════════════════════
print_header "TENANT CLOSURE CONFIRM (Plane #61/#62)"
START=$(date +%s)
set +e
bash "$SCRIPT_DIR/run-tenant-closure-e2e.sh" 2>&1
EC=$?
set -e
END=$(date +%s)
DURATION=$((END - START))
if [ "$EC" -eq 0 ]; then
  echo "    ✓ Tenant Closure Confirm (${DURATION}s)" >> "$RESULTS_FILE"
  PASSED=$((PASSED + 1))
else
  echo "    ✗ Tenant Closure Confirm FAILED (${DURATION}s) — exit $EC" >> "$RESULTS_FILE"
  FAILED=$((FAILED + 1))
fi

# ════════════════════════════════════════════════════
#  CLEAR STATE → OWNER
# ════════════════════════════════════════════════════
print_header "SIGN OUT → OWNER"
sign_out_and_stop

# ════════════════════════════════════════════════════
#  PHASE 2: OWNER
# ════════════════════════════════════════════════════
print_header "PHASE 2: OWNER (${#OWNER_FLOWS[@]} flows)"
for flow in "${OWNER_FLOWS[@]}"; do
  run_flow "$flow" \
    --env OWNER_EMAIL="$OWNER_EMAIL" \
    --env OWNER_PASSWORD="$OWNER_PASSWORD"
done

# ════════════════════════════════════════════════════
#  CLEAR STATE → VENDOR
# ════════════════════════════════════════════════════
print_header "SIGN OUT → VENDOR"
sign_out_and_stop

# ════════════════════════════════════════════════════
#  PHASE 3: VENDOR
# ════════════════════════════════════════════════════
print_header "PHASE 3: VENDOR (${#VENDOR_FLOWS[@]} flows)"
for flow in "${VENDOR_FLOWS[@]}"; do
  run_flow "$flow" \
    --env VENDOR_EMAIL="$VENDOR_EMAIL" \
    --env VENDOR_PASSWORD="$VENDOR_PASSWORD"
done

# ════════════════════════════════════════════════════
#  PHASE 4: E2E MAINTENANCE SMOKE (tenant creates → vendor quotes)
#  Opt-in smoke test: creates REAL rows on the LalaRente Supabase project
#  each run. Unique REQUEST_TITLE auto-generated so repeated runs don't
#  multi-match in the vendor list. NO sign_out needed here — the flow
#  self-manages sessions (cold-start stopApp + clearKeychain + role sign-outs).
# ════════════════════════════════════════════════════
# ════════════════════════════════════════════════════
#  PHASE 3B: VENDOR EARNINGS + BANKING (Plane #52)
#  seed payout prefs → Maestro UI flow (earnings dashboard → banking →
#  schedule radio change → save → verify). Mirrors the closure/payment wiring.
# ════════════════════════════════════════════════════
print_header "VENDOR EARNINGS + BANKING (Plane #52)"
START=$(date +%s)
set +e
bash "$SCRIPT_DIR/run-vendor-earnings-e2e.sh" 2>&1
EC=$?
set -e
END=$(date +%s)
DURATION=$((END - START))
if [ "$EC" -eq 0 ]; then
  echo "    ✓ Vendor Earnings + Banking (${DURATION}s)" >> "$RESULTS_FILE"
  PASSED=$((PASSED + 1))
else
  echo "    ✗ Vendor Earnings + Banking FAILED (${DURATION}s) — exit $EC" >> "$RESULTS_FILE"
  FAILED=$((FAILED + 1))
fi

print_header "PHASE 4: E2E MAINTENANCE SMOKE (tenant→vendor)"
E2E_TITLE="E2E Test - Leaking $(date +%s)"
run_flow "e2e-tenant-create-vendor-quote" \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  --env VENDOR_EMAIL="$VENDOR_EMAIL" \
  --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
  --env REQUEST_TITLE="$E2E_TITLE"

# ════════════════════════════════════════════════════
#  RESULTS
# ════════════════════════════════════════════════════
print_header " FULL E2E SUITE RESULTS "
echo ""
echo "  Tenant:  ${#TENANT_FLOWS[@]} flows"
echo "  Owner:   ${#OWNER_FLOWS[@]} flows"
echo "  Vendor:  ${#VENDOR_FLOWS[@]} flows"
echo "  ──────────────────────"
echo "  Total:   $(( ${#TENANT_FLOWS[@]} + ${#OWNER_FLOWS[@]} + ${#VENDOR_FLOWS[@]} )) flows"
echo ""
cat "$RESULTS_FILE"
echo ""
echo "  ──────────────────────"
echo "  PASSED:  $PASSED"
echo "  FAILED:  $FAILED"
echo "  TOTAL:   $((PASSED + FAILED))"
print_header ""

exit $FAILED
