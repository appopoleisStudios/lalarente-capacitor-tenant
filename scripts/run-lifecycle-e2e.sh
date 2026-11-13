#!/usr/bin/env bash
# Run lifecycle E2E flows (viewing → application → holding deposit → lease →
# inspection → maintenance → occupied) on the iOS simulator.
# Usage: scripts/run-lifecycle-e2e.sh [flow-name ...]   (default: full chain)
#   e.g. scripts/run-lifecycle-e2e.sh lifecycle-01-search-property
# Needs Metro running (scripts/start-metro-e2e.sh) and .maestro/.env.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; source .maestro/.env; set +a

SIM_UDID="${SIM_UDID:-F40A74AA-78B1-4B57-BDFE-108149D0D6B7}"
# Fixture: override in .maestro/.env to point at other test data
: "${LC_PROPERTY_ID:=2ee8cfaf-f02d-491b-8947-6c49975f5732}"
: "${LC_PROPERTY_TITLE:=2B Datura}"
: "${LC_OWNER_ID:=5b5bc816-b5a9-4eb3-babf-c20f4c0590f9}"
: "${LC_OTHER_TITLE:=96 De Waal}"
: "${LC_PRICE_MIN:=5400}"
: "${LC_PRICE_MAX:=5600}"
# Property used for decline / cancel / withdraw branches
: "${LC_BRANCH_PROPERTY_ID:=53ac13a1-ad41-45da-a9ff-2c8b7083ad74}"
: "${LC_BRANCH_PROPERTY_TITLE:=2A Datura}"
: "${LC_RENT:=5500}"
: "${LC_DEPOSIT:=5500}"
: "${LC_HOLDING_DEPOSIT:=2000}"
LC_TOKEN="${LC_TOKEN:-$(date +%m%d%H%M)}"

OUT=".maestro/lifecycle-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
[[ $# -eq 0 ]] && set -- lifecycle-00-full-chain
PASS=(); FAIL=()
for name in "$@"; do
  mkdir -p "$OUT/$name"
  ( set -o pipefail; cd "$OUT/$name" && maestro --device "$SIM_UDID" test "$ROOT/.maestro/flows/${name}.yaml" \
      --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" \
      --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" \
      --env VENDOR_EMAIL="${VENDOR_EMAIL:-}" --env VENDOR_PASSWORD="${VENDOR_PASSWORD:-}" \
      --env LC_TOKEN="$LC_TOKEN" \
      --env LC_PROPERTY_ID="$LC_PROPERTY_ID" --env LC_PROPERTY_TITLE="$LC_PROPERTY_TITLE" \
      --env LC_OWNER_ID="$LC_OWNER_ID" --env LC_OTHER_TITLE="$LC_OTHER_TITLE" \
      --env LC_PRICE_MIN="$LC_PRICE_MIN" --env LC_PRICE_MAX="$LC_PRICE_MAX" \
      --env LC_BRANCH_PROPERTY_ID="$LC_BRANCH_PROPERTY_ID" \
      --env LC_BRANCH_PROPERTY_TITLE="$LC_BRANCH_PROPERTY_TITLE" \
      --env LC_RENT="$LC_RENT" --env LC_DEPOSIT="$LC_DEPOSIT" \
      --env LC_HOLDING_DEPOSIT="$LC_HOLDING_DEPOSIT" 2>&1 | tee log.txt )
  if [[ $? -ne 0 ]] || grep -q "FAILED" "$OUT/$name/log.txt"; then FAIL+=("$name"); else PASS+=("$name"); fi
done
echo; echo "Passed (${#PASS[@]}): ${PASS[*]:-}"; echo "Failed (${#FAIL[@]}): ${FAIL[*]:-}"
echo "Output: $OUT"
exit ${#FAIL[@]}
