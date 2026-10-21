#!/usr/bin/env bash
# Run SQL against Supabase via management API. Prints JSON result.
# Usage: scripts/e2e-db.sh "select 1"
set -euo pipefail
source .env
if [ $# -lt 1 ]; then echo "usage: $0 \"<sql>\"" >&2; exit 2; fi
SQL="$1"
curl -sS -X POST \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -c -n --arg q "$SQL" '{query:$q}')"
echo
