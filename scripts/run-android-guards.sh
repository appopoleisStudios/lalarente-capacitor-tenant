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
sleep 2
if [[ "$(adb -s "$DEVICE" shell settings get secure navigation_mode | tr -d '\r')" != 0 ]]; then
  echo "✗ could not switch $DEVICE to 3-button navigation — guards would not catch nav-bar overlap" >&2
  exit 1
fi
echo "⚠ clears the app and resets the lifecycle fixture — don't run during a lifecycle run"

GUARDS=(
  tenant-tabbar-guard        # 5 canonical tenant tabs, no Vendor Payments tab
  vendor-tabbar-guard        # 6 canonical vendor tabs, no Contracts tab
  android-lease-sign-guard   # CT7-043: tenant + owner can sign on Android
  android-keyboard-forms-guard  # CT7-047: keyboard never covers pop-up form fields/buttons
  android-sheets-owner       # CT7-046: owner bottom sheets clear of the nav bar
  android-sheets-tenant      # CT7-046: tenant bottom sheets clear of the nav bar
  android-sheets-vendor      # CT7-046: vendor bottom sheets clear of the nav bar
)

run_guard() {
  local name="$1" extra=() status=0
  # Clean start: a failed clear would test a stale session, so fail the guard.
  adb -s "$DEVICE" shell pm clear com.lalarente.app 2>&1 | grep -q Success \
    || { echo "✗ $name: could not clear app data" >&2; return 1; }
  # Setup failures still go through the fixture reset below (a half-done setup
  # can leave a lease, application or deposit behind for the next guard).
  if [[ "$name" == android-lease-sign-guard ]]; then
    local lease_id
    if node scripts/reset-lifecycle-fixture.mjs --apply >/dev/null \
      && lease_id="$(node scripts/seed-sign-guard-lease.mjs)"; then
      extra=(--env LEASE_ID="$lease_id")
    else
      echo "✗ $name: setup (seed lease) failed" >&2; status=1
    fi
  fi
  if [[ "$name" == android-keyboard-forms-guard ]]; then
    # Its owner part needs a SUBMITTED application with no holding deposit
    # yet (Reject prompt + deposit dialog); without one the guard tested
    # nothing (build 14 gate). lifecycle-03a would also request the deposit.
    if ! { node scripts/reset-lifecycle-fixture.mjs --apply >/dev/null \
      && scripts/run-lifecycle-e2e.sh lifecycle-01-search-property lifecycle-02a-viewing-approve \
        script:scripts/e2e/viewing-happened.mjs lifecycle-02d-viewing-complete \
        setup-application-submitted > "$OUT/$name-setup.log" 2>&1; }; then
      echo "✗ $name: setup (lifecycle 01 → 02d + submit) failed — see $OUT/$name-setup.log" >&2
      status=1
    fi
    adb -s "$DEVICE" shell pm clear com.lalarente.app >/dev/null 2>&1
  fi
  if [[ $status == 0 ]]; then
    ( cd "$OUT" && maestro --device "$DEVICE" test "$ROOT/.maestro/flows/$name.yaml" \
        --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" \
        --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" \
        --env VENDOR_EMAIL="${VENDOR_EMAIL:-}" --env VENDOR_PASSWORD="${VENDOR_PASSWORD:-}" \
        ${extra[@]+"${extra[@]}"} > "$name.log" 2>&1 )
    status=$?
  fi
  if [[ "$name" == android-lease-sign-guard || "$name" == android-keyboard-forms-guard ]]; then
    # A failed cleanup leaves fixture data behind: that fails the guard.
    if ! node scripts/reset-lifecycle-fixture.mjs --apply > "$OUT/$name-reset.log" 2>&1; then
      echo "✗ $name: fixture reset failed — see $OUT/$name-reset.log" >&2
      return 1
    fi
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
