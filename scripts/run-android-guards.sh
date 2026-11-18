#!/usr/bin/env bash
# Android regression guards — release gate step 4 (CLAUDE.md).
# Runs every client-reported-bug guard flow on the Android emulator against the
# INSTALLED release APK. Each flow starts from a cleared app (signed out).
# Usage: scripts/run-android-guards.sh            (DEVICE defaults to emulator-5554)
# Add new guards to GUARDS below; a guard needing fixture data gets a setup
# step in run_guard().
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; source .maestro/.env; set +a
DEVICE="${DEVICE:-emulator-5554}"
OUT=".maestro/android-guards-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
# 3-button navigation: the tallest nav bar, so anything drawn under it fails.
adb -s "$DEVICE" shell cmd overlay enable com.android.internal.systemui.navbar.threebutton >/dev/null 2>&1

GUARDS=(
  tenant-tabbar-guard        # 5 canonical tenant tabs, no Vendor Payments tab
  android-lease-sign-guard   # CT7-043: tenant + owner can sign on Android
)

run_guard() {
  local name="$1" extra=()
  adb -s "$DEVICE" shell pm clear com.lalarente.app >/dev/null
  if [[ "$name" == android-lease-sign-guard ]]; then
    node scripts/reset-lifecycle-fixture.mjs --apply >/dev/null || return 1
    local lease_id
    lease_id="$(node scripts/seed-sign-guard-lease.mjs)" || return 1
    extra=(--env LEASE_ID="$lease_id")
  fi
  ( cd "$OUT" && maestro --device "$DEVICE" test "$ROOT/.maestro/flows/$name.yaml" \
      --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" \
      --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" \
      "${extra[@]}" > "$name.log" 2>&1 )
  local status=$?
  if [[ "$name" == android-lease-sign-guard ]]; then
    node scripts/reset-lifecycle-fixture.mjs --apply >/dev/null
  fi
  return $status
}

PASS=(); FAIL=()
for g in "${GUARDS[@]}"; do
  if run_guard "$g"; then PASS+=("$g"); else FAIL+=("$g"); fi
done
echo "Passed (${#PASS[@]}): ${PASS[*]:-}"
echo "Failed (${#FAIL[@]}): ${FAIL[*]:-}"
echo "Logs: $OUT"
exit ${#FAIL[@]}
