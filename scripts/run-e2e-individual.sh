#!/bin/bash
# Run each flow individually with per-flow screenshots and PASS/FAIL collection
# Usage: bash scripts/run-e2e-individual.sh
set -a
source .maestro/.env
set +a

MAESTRO="$HOME/.maestro/bin/maestro"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=180000
REPORT_FILE="/tmp/lalarente-e2e-report-$(date +%s).txt"
PASS=0; FAIL=0; SKIP=0
UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)

run_flow() {
  local flow="$1"; local label="$2"; local role="$3"
  shift 3; local extra_env=("$@")
  echo ""
  echo "━━ $role › $label"
  local output
  output=$("$MAESTRO" test "${extra_env[@]}" ".maestro/flows/$flow.yaml" 2>&1)
  local ec=$?
  # capture screenshot
  local slug=$(echo "$label" | tr '/ ' '--')
  xcrun simctl io "$UDID" screenshot "/tmp/lalarente-ss-${role}-${slug}.png" 2>/dev/null
  if [ $ec -eq 0 ]; then
    echo "  ✅ PASS — $label"
    echo "PASS | $role | $label" >> "$REPORT_FILE"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL — $label"
    # Extract last error line
    local err=$(echo "$output" | grep -E "FAILED|Assertion" | tail -3)
    echo "  ↳ $err"
    echo "FAIL | $role | $label | $err" >> "$REPORT_FILE"
    FAIL=$((FAIL+1))
  fi
}

T_ENV=(--env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD")
O_ENV=(--env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD")
V_ENV=(--env VENDOR_EMAIL="$VENDOR_EMAIL" --env VENDOR_PASSWORD="$VENDOR_PASSWORD")

echo "======================================================"
echo " LALARENTE FULL E2E — $(date)"
echo " Device: $UDID"
echo "======================================================"

# ── TENANT FLOWS ──
echo ""; echo "═══ TENANT ═══"
run_flow "01-tenant-dashboard"                   "Dashboard+Maintenance+AI"         "TENANT" "${T_ENV[@]}"
run_flow "02-tenant-lala-ai"                     "Lala AI Chat"                     "TENANT" "${T_ENV[@]}"
run_flow "03-tenant-maintenance"                 "Maintenance List"                 "TENANT" "${T_ENV[@]}"
run_flow "05-pr7-tenant-tenancy-shortcuts"       "Tenancy Shortcuts Nav"            "TENANT" "${T_ENV[@]}"
run_flow "06-pr7-tenant-disputes-empty"          "Payment Disputes Empty State"     "TENANT" "${T_ENV[@]}"
run_flow "07-pr7-tenant-application-pdf"         "Application PDF Upload"           "TENANT" "${T_ENV[@]}"
run_flow "08-pr9-tenant-inspections"             "Inspections Screen"               "TENANT" "${T_ENV[@]}"
run_flow "11-pr10-tenant-maintenance-message"    "Maintenance→Message Thread"       "TENANT" "${T_ENV[@]}"
run_flow "12-pr10-tenant-messaging-keyboard"     "Messaging Keyboard"               "TENANT" "${T_ENV[@]}"
run_flow "13-pr10-tenant-lease-pdf"              "Lease PDF Download"               "TENANT" "${T_ENV[@]}"
run_flow "14-pr10-tenant-maintenance-camera"     "Maintenance Camera"               "TENANT" "${T_ENV[@]}"
run_flow "17-pr11-tenant-viewings-applications"  "Viewings+Applications Nav"        "TENANT" "${T_ENV[@]}"
run_flow "client-feedback/s2-25-tenant-bell"     "S2-25: Bell Notifications"        "TENANT" "${T_ENV[@]}"

# ── TENANT PAYMENT HAPPY PATH (Plane #60) ──
# Orchestrated end-to-end: seed → Maestro UI flow → record-completion verify.
# Replaces the legacy 20-vendor-payments smoke (same UI, now fully wired).
#
# Payment Happy Path (seed→UI→completed record)
run_payment_e2e() {
  echo ""
  echo "━━ TENANT › Payment Happy Path (Plane #60)"
  local output
  output=$(bash scripts/run-tenant-payment-e2e.sh 2>&1)
  local ec=$?
  local slug="tenant-payment-happy-path"
  xcrun simctl io "$UDID" screenshot "/tmp/lalarente-ss-TENANT-${slug}.png" 2>/dev/null
  if [ $ec -eq 0 ]; then
    echo "  ✅ PASS — Payment Happy Path (Plane #60)"
    echo "PASS | TENANT | Payment Happy Path (Plane #60)" >> "$REPORT_FILE"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL — Payment Happy Path (Plane #60)"
    local err=$(echo "$output" | grep -E "FAILED|✗|Error|error" | tail -3)
    echo "  ↳ $err"
    echo "FAIL | TENANT | Payment Happy Path (Plane #60) | $err" >> "$REPORT_FILE"
    FAIL=$((FAIL+1))
  fi
}
run_payment_e2e

# ── TENANT CLOSURE CONFIRM + TIMELINE PHOTO (Plane #61/#62) ──
# Orchestrated end-to-end: seed closure state → Maestro UI flow
# (closure-confirm screen + timeline progress photo card).
run_closure_e2e() {
  echo ""
  echo "━━ TENANT › Closure Confirm + Timeline Photo (Plane #61/#62)"
  local output
  output=$(bash scripts/run-tenant-closure-e2e.sh 2>&1)
  local ec=$?
  local slug="tenant-closure-confirm"
  xcrun simctl io "$UDID" screenshot "/tmp/lalarente-ss-TENANT-${slug}.png" 2>/dev/null
  if [ $ec -eq 0 ]; then
    echo "  ✅ PASS — Closure Confirm (Plane #61/#62)"
    echo "PASS | TENANT | Closure Confirm (Plane #61/#62)" >> "$REPORT_FILE"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL — Closure Confirm (Plane #61/#62)"
    local err=$(echo "$output" | grep -E "FAILED|✗|Error|error" | tail -3)
    echo "  ↳ $err"
    echo "FAIL | TENANT | Closure Confirm (Plane #61/#62) | $err" >> "$REPORT_FILE"
    FAIL=$((FAIL+1))
  fi
}
run_closure_e2e
run_flow "client-feedback/s2-26-tenant-profile-docs" "S2-26: Profile+POA Upload"   "TENANT" "${T_ENV[@]}"
run_flow "client-feedback/s2-31-tenant-contact-owner" "S2-31: Contact Owner"       "TENANT" "${T_ENV[@]}"
run_flow "client-feedback/s2-32-tenant-payments" "S2-32: Payments History"         "TENANT" "${T_ENV[@]}"
run_flow "client-feedback/s2-40-tenant-send-message" "S2-40: Send Message"         "TENANT" "${T_ENV[@]}"

# ── OWNER FLOWS ──
echo ""; echo "═══ OWNER ═══"
run_flow "04-owner-dashboard"                    "Dashboard"                        "OWNER" "${O_ENV[@]}"
run_flow "09-pr9-owner-inspection-conduct"       "Inspection Conduct (rooms)"       "OWNER" "${O_ENV[@]}"
run_flow "10-pr9-owner-inspection-readonly"      "Inspection Read-only"             "OWNER" "${O_ENV[@]}"
run_flow "15-pr7-owner-disputes-empty"           "Payment Disputes Empty State"     "OWNER" "${O_ENV[@]}"
run_flow "16-pr6-owner-lala-ai"                  "Lala AI Chat"                     "OWNER" "${O_ENV[@]}"
run_flow "18-pr11-owner-applications"            "Applications Nav"                 "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-01-owner-dashboard" "S2-01: Dashboard Stats"          "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-02-owner-bell"      "S2-02: Bell"                     "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-03-owner-viewings"  "S2-03: Viewings Pending"         "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-08-owner-leases"    "S2-08: Active Leases"            "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-10-owner-lease-messages" "S2-10: Lease Messages"      "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-11-owner-rent-roll" "S2-11: Rent Roll"               "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-13-owner-maintenance" "S2-13: Maintenance Routing"   "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-19-owner-messages"  "S2-19: Messages Thread"         "OWNER" "${O_ENV[@]}"
run_flow "client-feedback/s2-21-owner-property"  "S2-21: Property Photos"         "OWNER" "${O_ENV[@]}"

# ── VENDOR FLOWS ──
echo ""; echo "═══ VENDOR ═══"
run_flow "vendor-dashboard"    "Dashboard Stats"    "VENDOR" "${V_ENV[@]}"
run_flow "vendor-notifications" "Notifications"     "VENDOR" "${V_ENV[@]}"
run_flow "vendor-messaging"    "Messaging"          "VENDOR" "${V_ENV[@]}"
run_flow "vendor-maintenance"  "Maintenance Reqs"   "VENDOR" "${V_ENV[@]}"
run_flow "vendor-ai-chat"      "Lala AI"            "VENDOR" "${V_ENV[@]}"


# ── VENDOR EARNINGS + BANKING (Plane #52) ──
# Orchestrated end-to-end: seed payout prefs → Maestro UI flow
# (earnings dashboard → banking → schedule radio change → save → verify).
run_earnings_e2e() {
  echo ""
  echo "━━ VENDOR › Earnings + Banking (Plane #52)"
  local output
  output=$(bash scripts/run-vendor-earnings-e2e.sh 2>&1)
  local ec=$?
  local slug="vendor-earnings-banking"
  xcrun simctl io "$UDID" screenshot "/tmp/lalarente-ss-VENDOR-${slug}.png" 2>/dev/null
  if [ $ec -eq 0 ]; then
    echo "  ✅ PASS — Earnings + Banking (Plane #52)"
    echo "PASS | VENDOR | Earnings + Banking (Plane #52)" >> "$REPORT_FILE"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL — Earnings + Banking (Plane #52)"
    local err=$(echo "$output" | grep -E "FAILED|✗|Error|error" | tail -3)
    echo "  ↳ $err"
    echo "FAIL | VENDOR | Earnings + Banking (Plane #52) | $err" >> "$REPORT_FILE"
    FAIL=$((FAIL+1))
  fi
}
run_earnings_e2e

# ── E2E MAINTENANCE SMOKE (tenant creates → vendor quotes) ──
# Opt-in smoke test: creates REAL rows on the LalaRente Supabase project each
# run. Unique REQUEST_TITLE auto-generated so repeated runs don't multi-match.
echo ""; echo "═══ E2E SMOKE (TENANT→VENDOR) ═══"
E2E_TITLE="E2E Test - Leaking $(date +%s)"
run_flow "e2e-tenant-create-vendor-quote" "Tenant creates→Vendor quotes" "E2E" "${T_ENV[@]}" "${V_ENV[@]}" --env REQUEST_TITLE="$E2E_TITLE"

# ── SUMMARY ──
echo ""
echo "======================================================"
echo " RESULTS"
echo "======================================================"
echo " PASS: $PASS  |  FAIL: $FAIL  |  TOTAL: $((PASS+FAIL))"
echo ""
echo "── FAILURES ──"
grep "^FAIL" "$REPORT_FILE" 2>/dev/null || echo "  (none)"
echo ""
echo "Full report: $REPORT_FILE"
echo "Screenshots: /tmp/lalarente-ss-*.png"
