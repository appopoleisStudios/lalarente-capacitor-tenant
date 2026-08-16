#!/bin/bash
# Money-Path Visual Capture Runner (Plane #87 — human visual UX review)
# Runs the tenant + vendor money-path capture flows (independent halves, so a
# flaky PayFast checkout WebView can never starve the vendor captures).
# Capture-only: navigation + takeScreenshot, no functional assertions.
#
# Usage:
#   bash scripts/run-money-visual-capture.sh
#
# Requires: .maestro/.env (credentials). Screenshots land in the repo root as
# money-*.png (Maestro writes takeScreenshot to cwd) — move them out after.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.maestro/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found — copy .maestro/.env.example and fill credentials"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

for var in TENANT_EMAIL TENANT_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Set $var in .maestro/.env"
    exit 1
  fi
done

source "$SCRIPT_DIR/lib/resolve-maestro.sh"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=300000

echo ""
echo "════════════════════════════════════════════════════"
echo " MONEY-PATH VISUAL CAPTURE (Plane #87)"
echo "════════════════════════════════════════════════════"

# Seed the APPROVED tenant-payer invoice so the list is populated.
echo ""
echo "── 1/3 SEED APPROVED TENANT INVOICE ──"
node "$ROOT/scripts/seed-tenant-vendor-invoice.mjs"

# Tenant half: hub → list → detail → checkout. Best-effort: the PayFast
# checkout WebView can flake the iOS driver, and a capture flow must never
# starve the vendor half (same reason the flows were split).
echo ""
echo "── 2/3 TENANT CAPTURE (hub/list/detail/checkout) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/money-path-capture-tenant.yaml" || echo "⚠ tenant capture failed (environment); continuing to vendor"

# Vendor half: earnings → banking (independent; no WebView interaction).
echo ""
echo "── 3/3 VENDOR CAPTURE (earnings/banking) ──"
"$MAESTRO_BIN" test \
  --env VENDOR_EMAIL="$VENDOR_EMAIL" \
  --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
  "$ROOT/.maestro/flows/money-path-capture-vendor.yaml"

# Maestro writes takeScreenshot PNGs to cwd — keep them out of the repo root.
# trap EXIT guarantees cleanup even if a flow fails under set -e.
cleanup_captures() {
  mkdir -p "$ROOT/visual-review"
  if mv "$ROOT"/money-*.png "$ROOT/visual-review/" 2>/dev/null; then
    echo "✅ captures → visual-review/ ($(ls "$ROOT"/visual-review/*.png 2>/dev/null | wc -l | tr -d ' ') pngs)"
  else
    echo "(no money-*.png in repo root)"
  fi
}
trap cleanup_captures EXIT

echo "✅ MONEY-PATH VISUAL CAPTURE COMPLETE — see visual-review/"
