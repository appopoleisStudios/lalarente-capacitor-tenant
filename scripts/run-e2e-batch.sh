#!/usr/bin/env bash
# Run a batch of E2E flow files (names as args), rebooting sim between each.
set -u
SIM="F40A74AA-78B1-4B57-BDFE-108149D0D6B7"
OUT=".maestro/e2e-batch-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
set -a; source .maestro/.env; set +a
PASS=(); FAIL=()
reboot() {
  pkill -f "XCTRunner" 2>/dev/null || true
  pkill -f "WebDriverAgent" 2>/dev/null || true
  xcrun simctl shutdown "$SIM" >/dev/null 2>&1 || true
  sleep 4
  xcrun simctl boot "$SIM" >/dev/null 2>&1 || true
  sleep 7
}
for name in "$@"; do
  flow=".maestro/flows/${name}.yaml"
  dir="$OUT/$name"
  mkdir -p "$dir"
  echo
  echo "=== RUN: $name ==="
  reboot
  TOK="$(date +%H%M%S)"
  if maestro test "$flow" \
      --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" \
      --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" \
      --env VENDOR_EMAIL="$VENDOR_EMAIL" --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
      --env REQ_TOKEN="$TOK" --env MSG_TOKEN="$TOK" --env VIEW_TOKEN="$TOK" \
      --format junit --output "$dir/report.xml" 2>&1 | tee "$dir/log.txt" && \
     grep -q "Flow Passed" "$dir/log.txt"; then
    echo "PASS: $name"; PASS+=("$name")
  else
    echo "FAIL: $name"; FAIL+=("$name")
  fi
done
echo
echo "=== BATCH SUMMARY ==="
echo "Passed (${#PASS[@]}): ${PASS[*]}"
echo "Failed (${#FAIL[@]}): ${FAIL[*]}"
exit ${#FAIL[@]}
