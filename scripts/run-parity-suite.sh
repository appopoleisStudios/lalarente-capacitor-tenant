#!/usr/bin/env bash
# Run the full parity UAT suite.
# Reboots the sim between flows to recover XCTest state.
# Usage: ./scripts/run-parity-suite.sh [sim-udid]

set -u

SIM_UDID="${1:-F40A74AA-78B1-4B57-BDFE-108149D0D6B7}"
OUTPUT_ROOT=".maestro/parity-suite-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_ROOT"

set -a; source .maestro/.env; set +a

TOKEN="$(date +%H%M%S)"
PASS=()
FAIL=()

reboot_sim() {
  pkill -f "XCTRunner" 2>/dev/null || true
  pkill -f "WebDriverAgent" 2>/dev/null || true
  xcrun simctl shutdown "$SIM_UDID" >/dev/null 2>&1 || true
  sleep 4
  xcrun simctl boot "$SIM_UDID" >/dev/null 2>&1 || true
  sleep 7
}

run_flow() {
  local flow="$1"
  local name="$(basename "$flow" .yaml)"
  local dir="$OUTPUT_ROOT/$name"
  mkdir -p "$dir"
  echo
  echo "============================================================"
  echo "RUN: $name"
  echo "============================================================"
  reboot_sim
  if maestro test "$flow" \
      --env TENANT_EMAIL="$TENANT_EMAIL" \
      --env TENANT_PASSWORD="$TENANT_PASSWORD" \
      --env OWNER_EMAIL="$OWNER_EMAIL" \
      --env OWNER_PASSWORD="$OWNER_PASSWORD" \
      --env VENDOR_EMAIL="$VENDOR_EMAIL" \
      --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
      --env MSG_TOKEN="$TOKEN" \
      --env REQ_TOKEN="$TOKEN" \
      --format junit \
      --output "$dir/report.xml" 2>&1 | tee "$dir/log.txt"; then
    if grep -q "Flow Passed" "$dir/log.txt"; then
      echo "PASS: $name"
      PASS+=("$name")
    else
      echo "FAIL: $name"
      FAIL+=("$name")
    fi
  else
    echo "FAIL: $name (exit)"
    FAIL+=("$name")
  fi
}

for flow in .maestro/flows/parity-*.yaml; do
  run_flow "$flow"
done

echo
echo "============================================================"
echo "PARITY SUITE SUMMARY"
echo "============================================================"
echo "Passed (${#PASS[@]}):"
for p in "${PASS[@]}"; do echo "  ✓ $p"; done
echo "Failed (${#FAIL[@]}):"
for f in "${FAIL[@]}"; do echo "  ✗ $f"; done

if [ "${#FAIL[@]}" -gt 0 ]; then
  exit 1
fi
