#!/usr/bin/env bash
# Fresh-start wipe — truncates every public.* table so client testers
# begin from empty state. auth.users is preserved (sign-in survives).
# Storage buckets are NOT touched.
#
# Dormant by default. Requires --confirm to fire. Prints the full plan,
# a 10-second countdown, then TRUNCATEs with RESTART IDENTITY CASCADE.
#
# Usage:
#   scripts/db-wipe-fresh.sh                 # dry-run: prints plan, exits
#   scripts/db-wipe-fresh.sh --confirm       # arms the wipe
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

TABLES=(
  arrears_escalations closure_mediation_messages closure_reports co_applicants
  consent_records contract_documents contract_management_audit_logs
  contract_notifications contract_templates data_access_requests
  data_correction_requests data_deletion_requests dedicated_vendors
  deposit_deductions deposit_disputes deposit_interest_accruals
  dev_function_logs document_access_log documents holding_deposits
  inspection_audit_logs inspection_photos inspections insurance_claim_documents
  insurance_claims insurance_policies invoice_talk_confirmations job_attachments
  job_executions job_progress_updates key_handovers lease_addendums leases
  maintenance_invoice_audit_logs maintenance_invoices
  maintenance_request_audit_logs maintenance_requests message_attachments
  message_threads messages notification_preferences notifications
  payment_arrangements payment_disputes payment_schedules payments po_revisions
  privacy_audit_log profiles properties property_amenities property_assignments
  property_photos property_waitlist purchase_order_lines purchase_orders
  quote_lines quote_revisions quotes refunds renewal_negotiations
  rental_applications retention_policies sa_public_holidays service_categories
  service_contract_audit_logs service_contract_signatures service_contracts
  standard_amenities tenancy_contract_audit_logs tenancy_contract_signatures
  tenancy_contracts vendor_availability_slots vendor_documents
  vendor_email_invites vendor_no_shows vendor_payment_ledger vendor_payments
  vendor_payout_preferences vendor_private_contacts vendor_quote_requests
  vendor_ratings vendor_service_areas vendor_services vendor_warranties
  viewing_cancellations viewing_requests
)

JOINED=$(IFS=', '; echo "${TABLES[*]}")

echo "===================================================================="
echo "FRESH-START DB WIPE — Lalarente ($SUPABASE_PROJECT_ID)"
echo "===================================================================="
echo "Will TRUNCATE ${#TABLES[@]} public tables with RESTART IDENTITY CASCADE:"
echo "$JOINED" | fold -s -w 72 | sed 's/^/  /'
echo
echo "PRESERVED: auth.users (sign-in). Storage buckets untouched."
echo

if [ "${1:-}" != "--confirm" ]; then
  echo "DRY RUN. Re-run with --confirm to execute."
  exit 0
fi

echo "ARMED. 10s to abort with Ctrl-C."
for i in 10 9 8 7 6 5 4 3 2 1; do printf '\r  %2d...' "$i"; sleep 1; done
echo

SQL="TRUNCATE $JOINED RESTART IDENTITY CASCADE"
echo
echo "Executing: $SQL" | fold -s -w 76 | sed 's/^/  /'
echo
./scripts/e2e-db.sh "$SQL"
echo
echo "Verifying all tables empty..."
./scripts/e2e-db.sh "select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, false, '')))[1]::text::int as rows from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by rows desc, table_name limit 5"
echo
echo "✅ Wipe complete. auth.users retained."
