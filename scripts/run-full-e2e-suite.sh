#!/bin/bash
# Run full E2E test suite in phases:
# Phase 1: Tenant flows
# Phase 2: Clears SecureStore, then Owner flows
# Phase 3: Vendor flows
# Reports EXIT codes for all flows at the end.

set -e
cd ~/Developer/lalarente/lalarente-app
source .maestro/.env

RESULTS_FILE="/tmp/e2e-results-$(date +%s).txt"
> "$RESULTS_FILE"

TENANT_FLOWS=(
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
)

OWNER_FLOWS=(
  "04-owner-dashboard"
  "09-pr9-owner-inspection-conduct"
  "10-pr9-owner-inspection-readonly"
  "15-pr7-owner-disputes-empty"
  "16-pr6-owner-lala-ai"
  "18-pr11-owner-applications"
)

VENDOR_FLOWS=(
  "20-vendor-payments"
)

run_flow() {
  local flow="$1"
  shift
  echo "  Running: $flow..."
  START=$(date +%s)
  set +e
  ~/.maestro/bin/maestro test "$@" ".maestro/flows/$flow.yaml" 2>&1
  EC=$?
  set -e
  END=$(date +%s)
  DURATION=$((END - START))
  echo "$flow: EXIT=$EC (${DURATION}s)" >> "$RESULTS_FILE"
  if [ "$EC" -eq 0 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
}

reinstall_app() {
  echo "  Reinstalling app..."
  xcrun simctl uninstall booted com.lalarente.app 2>/dev/null || true
  # Find the existing build binary and install it (fast, no rebuild needed)
  APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "lalarenteapp.app" -type d 2>/dev/null | head -1)
  if [ -n "$APP_PATH" ]; then
    xcrun simctl install booted "$APP_PATH" 2>&1
    echo "  App reinstalled from: $APP_PATH"
  else
    echo "  No existing build found, rebuilding..."
    npx expo run:ios --configuration Debug 2>&1 | tail -3
  fi
}

PASSED=0
FAILED=0

echo "========================================"
echo "  PHASE 1: TENANT FLOWS"
echo "========================================"
for flow in "${TENANT_FLOWS[@]}"; do
  run_flow "$flow" --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD"
done

echo "========================================"
echo "  CLEAR STATE FOR OWNER PHASE"
echo "========================================"
reinstall_app

echo "========================================"
echo "  PHASE 2: OWNER FLOWS"
echo "========================================"
for flow in "${OWNER_FLOWS[@]}"; do
  run_flow "$flow" --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD"
done

echo "========================================"
echo "  PHASE 3: VENDOR FLOWS"
echo "========================================"
for flow in "${VENDOR_FLOWS[@]}"; do
  run_flow "$flow" --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD"
done

echo ""
echo "═══════════════════════════════════════"
echo "  FULL E2E SUITE RESULTS"
echo "═══════════════════════════════════════"
cat "$RESULTS_FILE"
echo "───────────────────────────────────────"
echo "  PASSED: $PASSED"
echo "  FAILED: $FAILED"
echo "  TOTAL:  $((PASSED + FAILED))"
echo "═══════════════════════════════════════"

exit $FAILED
