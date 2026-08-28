#!/bin/bash
# LAL-118 — Maintenance pipeline orchestrator (no silent gaps)
#
# What this is: one runner that chains the pieces we actually have.
# What this is not: one Maestro flow that walks a single live job
#   raise → quote → owner PO → work → close → invoice → PayFast card.
# PayFast hosted WebView cannot be filled by Maestro; money completion is
# signed ITN through payment-webhook (tenant Plane #60, owner LAL-116).
#
# Steps:
#   1. Tenant create request + vendor quote (Maestro) unless SKIP_MAESTRO=1
#   2. Tenant pay happy path (existing run-tenant-payment-e2e.sh)
#   3. Owner pay path if scripts/run-owner-payment-e2e.sh exists (LAL-116)
#
# Usage:
#   bash scripts/run-maintenance-pipeline-e2e.sh
#   SKIP_MAESTRO=1 bash scripts/run-maintenance-pipeline-e2e.sh
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

echo ""
echo "════════════════════════════════════════════════════"
echo " MAINTENANCE PIPELINE ORCHESTRATOR (LAL-118)"
echo "════════════════════════════════════════════════════"
echo "Covered: tenant create+vendor quote (UI), tenant pay (UI+ITN),"
echo "         owner pay (UI+ITN when LAL-116 script is present)."
echo "Not covered in one job: owner accept quote / PO, vendor work/closure,"
echo "         live PayFast card entry."
echo ""

FAILED=0

run_step() {
  local name="$1"
  shift
  echo ""
  echo "── $name ──"
  set +e
  "$@"
  local ec=$?
  set -e
  if [[ $ec -ne 0 ]]; then
    echo "✗ FAILED: $name (exit $ec)"
    FAILED=$((FAILED + 1))
  else
    echo "✓ $name"
  fi
}

if [[ "${SKIP_MAESTRO:-}" != "1" ]]; then
  source "$SCRIPT_DIR/lib/resolve-maestro.sh"
  REQUEST_TITLE="${REQUEST_TITLE:-E2E Pipeline $(date +%s)}"
  run_step "Tenant create + vendor quote (Maestro)" \
    "$MAESTRO_BIN" test \
      --env TENANT_EMAIL="$TENANT_EMAIL" \
      --env TENANT_PASSWORD="$TENANT_PASSWORD" \
      --env VENDOR_EMAIL="$VENDOR_EMAIL" \
      --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
      --env REQUEST_TITLE="$REQUEST_TITLE" \
      "$ROOT/.maestro/flows/e2e-tenant-create-vendor-quote.yaml"
else
  echo "── Tenant create + vendor quote SKIPPED (SKIP_MAESTRO=1) ──"
fi

if [[ -x "$ROOT/scripts/run-tenant-payment-e2e.sh" ]]; then
  if [[ "${SKIP_MAESTRO:-}" == "1" ]]; then
    echo "── Tenant pay Maestro skipped; verify-only not exposed by tenant runner ──"
    echo "    Run bash scripts/run-tenant-payment-e2e.sh when a simulator is up."
  else
    run_step "Tenant pay (seed → Maestro → ITN)" bash "$ROOT/scripts/run-tenant-payment-e2e.sh"
  fi
fi

if [[ -x "$ROOT/scripts/run-owner-payment-e2e.sh" ]]; then
  run_step "Owner pay (LAL-116)" env SKIP_MAESTRO="${SKIP_MAESTRO:-}" bash "$ROOT/scripts/run-owner-payment-e2e.sh"
else
  echo "── Owner pay SKIPPED — merge LAL-116 (scripts/run-owner-payment-e2e.sh) ──"
fi

echo ""
if [[ "$FAILED" -gt 0 ]]; then
  echo "✗ PIPELINE ORCHESTRATOR: $FAILED step(s) failed"
  exit 1
fi
echo "✅ PIPELINE ORCHESTRATOR finished (see gaps in header — not a single-job walk)"
