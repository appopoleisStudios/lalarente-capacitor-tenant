#!/usr/bin/env bash
# Maestro gate for Autopilot / 3D / Lala / rent EFT. Captures real exit codes (no tee|tail PIPESTATUS).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/resolve-maestro.sh
source "$ROOT/scripts/lib/resolve-maestro.sh"
ENV_FILE="$ROOT/.maestro/.env"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
REPORT="${TMPDIR:-/tmp}/lalarente-maestro-built.txt"
: > "$REPORT"
run() {
  local name="$1"
  echo ""
  echo "━━━━━━━━ $name ━━━━━━━━"
  "$MAESTRO_BIN" test ".maestro/flows/${name}.yaml" \
    --env TENANT_EMAIL="$TENANT_EMAIL" \
    --env TENANT_PASSWORD="$TENANT_PASSWORD" \
    --env OWNER_EMAIL="$OWNER_EMAIL" \
    --env OWNER_PASSWORD="$OWNER_PASSWORD" \
    --env VENDOR_EMAIL="$VENDOR_EMAIL" \
    --env VENDOR_PASSWORD="$VENDOR_PASSWORD"
  local ec=$?
  if [ "$ec" = "0" ]; then
    echo "PASS $name" | tee -a "$REPORT"
  else
    echo "FAIL $name exit=$ec" | tee -a "$REPORT"
  fi
}
run owner-autopilot-smoke
run 04-owner-dashboard
run property-3d-tour
run owner-property-edit
run lala-ai-owner-chips
run client-feedback/s2-32-tenant-payments
run property-3d-tour-tenant
echo ""
echo "======== SUMMARY ========"
cat "$REPORT"
grep -q '^FAIL ' "$REPORT" && exit 1
exit 0
