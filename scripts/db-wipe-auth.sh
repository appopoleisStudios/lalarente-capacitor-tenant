#!/usr/bin/env bash
# Wipe auth.users (and cascade profiles) so every user starts fresh.
# Preserves SA admin-managed reference data: holidays, retention,
# service_categories, standard_amenities, contract_templates.
# Dormant by default. Requires --confirm.
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

echo "===================================================================="
echo "AUTH WIPE — Lalarente ($SUPABASE_PROJECT_ID)"
echo "===================================================================="
echo "DELETE: every row in auth.users (cascades to public.profiles)"
echo "KEEP:   sa_public_holidays, retention_policies, service_categories,"
echo "        standard_amenities, contract_templates"
echo "        storage buckets"
echo

if [ "${1:-}" != "--confirm" ]; then
  echo "DRY RUN. Re-run with --confirm to execute."
  exit 0
fi

echo "ARMED. 10s to abort with Ctrl-C."
for i in 10 9 8 7 6 5 4 3 2 1; do printf '\r  %2d...' "$i"; sleep 1; done
echo

./scripts/e2e-db.sh "delete from auth.users"
echo
echo "Post-wipe counts:"
./scripts/e2e-db.sh "select 'auth.users' as t, count(*) from auth.users union all select 'profiles', count(*) from profiles union all select 'sa_public_holidays', count(*) from sa_public_holidays union all select 'service_categories', count(*) from service_categories union all select 'standard_amenities', count(*) from standard_amenities union all select 'retention_policies', count(*) from retention_policies union all select 'contract_templates', count(*) from contract_templates"
echo
echo "✅ Auth wipe complete. Users can register fresh via the app."
