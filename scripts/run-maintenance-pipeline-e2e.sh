#!/bin/bash
# LAL-122 — One live job: raise → quote → PO → work → close → invoice → pay
#
# Device (Maestro): tenant create, vendor quote, tenant accept/PO, vendor start.
# API (same REQUEST_TITLE): progress, closure, tenant complete, invoice, ITN.
# PayFast hosted card WebView is not Maestro-fillable (same as Plane #60).
#
# Usage:
#   bash scripts/run-maintenance-pipeline-e2e.sh
#   SKIP_MAESTRO=1 REQUEST_TITLE="E2E LiveJob …" bash scripts/run-maintenance-pipeline-e2e.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.maestro/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

REQUEST_TITLE="${REQUEST_TITLE:-E2E LiveJob $(date +%s)}"
export REQUEST_TITLE

echo ""
echo "════════════════════════════════════════════════════"
echo " LIVE JOB PIPELINE (LAL-122)  ${REQUEST_TITLE}"
echo "════════════════════════════════════════════════════"

if [[ "${SKIP_MAESTRO:-}" != "1" ]]; then
  source "$SCRIPT_DIR/lib/resolve-maestro.sh"
  echo ""
  echo "── Maestro: raise → quote → tenant PO → vendor start ──"
  "$MAESTRO_BIN" test \
    --env TENANT_EMAIL="$TENANT_EMAIL" \
    --env TENANT_PASSWORD="$TENANT_PASSWORD" \
    --env VENDOR_EMAIL="$VENDOR_EMAIL" \
    --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
    --env REQUEST_TITLE="$REQUEST_TITLE" \
    "$ROOT/.maestro/flows/e2e-live-job-pipeline.yaml"
else
  echo "── Maestro skipped (SKIP_MAESTRO=1) — walking existing REQUEST_TITLE ──"
fi

echo ""
echo "── Walk: progress → close → invoice → PayFast ITN ──"
node "$ROOT/scripts/walk-maintenance-pipeline.mjs"

echo ""
echo "✅ LIVE JOB PIPELINE finished for: ${REQUEST_TITLE}"
