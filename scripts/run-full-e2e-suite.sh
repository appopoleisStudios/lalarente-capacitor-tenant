#!/bin/bash
# Run full E2E test suite in phases
# Phase 1: Tenant flows (01-03, 05-08, 11-14, 17)
# Phase 2: Owner flows (04, 09-10, 15-16, 18)
# Phase 3: Vendor flows (20)
# Reports EXIT codes for all flows at the end.

set -e

cd ~/Developer/lalarente/lalarente-app
source .maestro/.env

RESULTS_FILE="/tmp/e2e-results-$(date +%s).txt"
> "$RESULTS_FILE"

echo "=== PHASE 1: TENANT FLOWS ==="
TENANT_FLOWS="01-tenant-dashboard 02-tenant-lala-ai 03-tenant-maintenance 05-pr7-tenant-tenancy-shortcuts 06-pr7-tenant-disputes-empty 07-pr7-tenant-application-pdf 08-pr9-tenant-inspections 11-pr10-tenant-maintenance-message 12-pr10-tenant-messaging-keyboard 13-pr10-tenant-lease-pdf 14-pr10-tenant-maintenance-camera 17-pr11-tenant-viewings-applications"

PASSED=0
FAILED=0

for flow in $TENANT_FLOWS; do
  echo "  Running: $flow..."
  START=$(date +%s)
  set +e
  ~/.maestro/bin/maestro test --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" ".maestro/flows/$flow.yaml" 2>&1
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
done

echo "=== CLEARING APP DATA FOR OWNER PHASE ==="
# Uninstall app to clear SecureStore session
xcrun simctl uninstall booted com.lalarente.app 2>/dev/null || true
echo "  App uninstalled. Rebuilding..."
cd ~/Developer/lalarente/lalarente-app
npx expo run:ios --configuration Debug 2>&1 | tail -3
echo "  Rebuild done."

echo "=== PHASE 2: OWNER FLOWS ==="
OWNER_FLOWS="04-owner-dashboard 09-pr9-owner-inspection-conduct 10-pr9-owner-inspection-readonly 15-pr7-owner-disputes-empty 16-pr6-owner-lala-ai 18-pr11-owner-applications"

for flow in $OWNER_FLOWS; do
  echo "  Running: $flow..."
  START=$(date +%s)
  set +e
  ~/.maestro/bin/maestro test --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" ".maestro/flows/$flow.yaml" 2>&1
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
