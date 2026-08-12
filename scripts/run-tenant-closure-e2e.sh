#!/bin/bash
# Tenant Closure Confirm + Timeline Photo — end-to-end E2E (Plane #61/#62)
# Orchestrates the full closure-confirm happy path:
#   1. Seed deterministic state (owner assigns vendor → vendor stamps closure →
#      idempotent progress update with photo) via seed-tenant-closure-confirm.mjs.
#   2. Run the Maestro UI flow (login → maintenance list → closure CTA →
#      closure-confirm screen with photos → timeline progress photo card).
#
# This is what the suite runners invoke (run-e2e-individual.sh,
# run-full-e2e-suite.sh) so the closure-confirm screens are covered in the
# suite — mirroring the tenant-payment-happy-path wiring (Plane #60).
#
# Usage:
#   bash scripts/run-tenant-closure-e2e.sh
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
echo " TENANT CLOSURE CONFIRM + TIMELINE PHOTO (Plane #61/#62)"
echo "════════════════════════════════════════════════════"

# ── Step 1: seed deterministic closure-confirm state ──
echo ""
echo "── 1/2 SEED CLOSURE STATE ──"
node "$ROOT/scripts/seed-tenant-closure-confirm.mjs"

# ── Step 2: Maestro UI flow ──
echo ""
echo "── 2/3 MAESTRO UI FLOW (21-pr16-tenant-closure-confirm) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/21-pr16-tenant-closure-confirm.yaml"

# ── Step 3: MediaGallery open/close smoke (user bug — PR #145) ──
# Reuses the SAME seeded state: the timeline progress-update photo renders
# MediaGallery on the detail screen. Proves open full-screen → close button
# tappable → back on the detail screen (the exact bug class the user hit).
echo ""
echo "── 3/3 MAESTRO GATE (tenant-media-gallery-close) ──"
"$MAESTRO_BIN" test \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  "$ROOT/.maestro/flows/tenant-media-gallery-close.yaml"

echo ""
echo "✅ TENANT CLOSURE E2E PASSED (seed → closure-confirm UI → timeline photo → MediaGallery close)"
