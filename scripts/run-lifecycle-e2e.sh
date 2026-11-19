#!/usr/bin/env bash
# Run lifecycle E2E flows (viewing → application → holding deposit → lease →
# inspection → maintenance → occupied) on the Android emulator (the client's
# platform) with the installed release APK. iOS: DEVICE=<simulator UDID>.
# Usage: scripts/run-lifecycle-e2e.sh [flow-name ...]   (default: full chain)
#   e.g. scripts/run-lifecycle-e2e.sh lifecycle-01-search-property
# Needs .maestro/.env, and the APK under test installed on the emulator
# (iOS sim only: Metro running via scripts/start-metro-e2e.sh).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; source .maestro/.env; set +a

# Android emulator by default — every release check runs on Android. iOS only
# when asked for explicitly: DEVICE=<simulator UDID>.
DEVICE="${DEVICE:-emulator-5554}"
if adb -s "$DEVICE" get-state >/dev/null 2>&1; then PLATFORM=android; else PLATFORM=ios; fi
restart_app() {
  if [[ "$PLATFORM" == android ]]; then
    adb -s "$DEVICE" shell am force-stop com.lalarente.app
  else
    xcrun simctl terminate "$DEVICE" com.lalarente.app 2>/dev/null
  fi
}
# Fixture: override in .maestro/.env to point at other test data
: "${LC_PROPERTY_ID:=2ee8cfaf-f02d-491b-8947-6c49975f5732}"
: "${LC_PROPERTY_TITLE:=2B Datura}"
: "${LC_OWNER_ID:=5b5bc816-b5a9-4eb3-babf-c20f4c0590f9}"
: "${LC_OTHER_TITLE:=96 De Waal}"
: "${LC_PRICE_MIN:=5400}"
: "${LC_PRICE_MAX:=5600}"
# Property used for decline / cancel / withdraw branches
: "${LC_BRANCH_PROPERTY_ID:=53ac13a1-ad41-45da-a9ff-2c8b7083ad74}"
: "${LC_BRANCH_PROPERTY_TITLE:=2A Datura}"
: "${LC_RENT:=5500}"
: "${LC_DEPOSIT:=5500}"
: "${LC_HOLDING_DEPOSIT:=2000}"
# how the amount appears in dialogs (en-ZA: "R 2 000,00")
: "${LC_HOLDING_DEPOSIT_TEXT:=2.000}"
LC_TOKEN="${LC_TOKEN:-$(date +%m%d%H%M)}"

OUT=".maestro/lifecycle-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
# Record what this run tested — the release gate needs the device and the APK.
{
  echo "device:   $DEVICE ($PLATFORM)"
  if [[ "$PLATFORM" == android ]]; then
    adb -s "$DEVICE" shell dumpsys package com.lalarente.app | grep -E "versionCode|lastUpdateTime" | sed 's/^ */apk:      /'
  fi
  echo "commit:   $(git rev-parse --short HEAD)"
} | tee "$OUT/device.txt"
# The photo steps pick the newest photo in the device library: make sure one exists.
if [[ "$PLATFORM" == android ]]; then
  adb -s "$DEVICE" push "$ROOT/.maestro/assets/e2e-photo.jpg" /sdcard/Pictures/e2e-photo.jpg >/dev/null
  adb -s "$DEVICE" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Pictures/e2e-photo.jpg >/dev/null
fi
# Full chain. The viewing must have happened before the tenant can apply
# (CT7-032), so 02a is followed by moving it into the past and 02d.
[[ $# -eq 0 ]] && set -- lifecycle-01-search-property lifecycle-02a-viewing-approve \
  script:scripts/e2e/viewing-happened.mjs lifecycle-02d-viewing-complete \
  lifecycle-03a-application-submit lifecycle-04-holding-deposit lifecycle-05-lease-create-sign \
  lifecycle-06-inspection lifecycle-07-inspection-issue-maintenance lifecycle-07b-issue-vendor-quote \
  lifecycle-07c-send-po lifecycle-07d-work-closure-verification lifecycle-08-occupied
PASS=(); FAIL=()
for name in "$@"; do
  # "script:<path>" runs a Node helper (e.g. moving a viewing into the past)
  if [[ "$name" == script:* ]]; then
    if LC_PROPERTY_ID="$LC_PROPERTY_ID" node "${name#script:}"; then PASS+=("$name"); else FAIL+=("$name"); fi
    continue
  fi
  mkdir -p "$OUT/$name"
  # Retry ONLY when the Maestro driver itself crashed (e.g. iOS 26 XCUITest
  # "kAXErrorInvalidUIElement" while a sheet animates) — never when an app
  # check failed. Flows are written to be re-runnable from their start.
  for attempt in 1 2 3; do
    rm -f "$OUT/$name/log.txt"
    # Watchdog: after a driver exception Maestro can hang instead of exiting;
    # kill it once the log mentions the exception so the retry can run.
    ( while sleep 10; do
        [[ -f "$OUT/$name/log.txt" ]] && grep -q "Exception in thread" "$OUT/$name/log.txt" && {
          sleep 20; pkill -f "maestro.cli.AppKt" ; break; }
        pgrep -f "maestro.cli.AppKt" >/dev/null || break
      done ) &
    watchdog=$!
    ( set -o pipefail; cd "$OUT/$name" && maestro --device "$DEVICE" test "$ROOT/.maestro/flows/${name}.yaml" \
        --env TENANT_EMAIL="$TENANT_EMAIL" --env TENANT_PASSWORD="$TENANT_PASSWORD" \
        --env OWNER_EMAIL="$OWNER_EMAIL" --env OWNER_PASSWORD="$OWNER_PASSWORD" \
        --env VENDOR_EMAIL="${VENDOR_EMAIL:-}" --env VENDOR_PASSWORD="${VENDOR_PASSWORD:-}" \
        --env LC_TOKEN="$LC_TOKEN" \
        --env LC_PROPERTY_ID="$LC_PROPERTY_ID" --env LC_PROPERTY_TITLE="$LC_PROPERTY_TITLE" \
        --env LC_OWNER_ID="$LC_OWNER_ID" --env LC_OTHER_TITLE="$LC_OTHER_TITLE" \
        --env LC_PRICE_MIN="$LC_PRICE_MIN" --env LC_PRICE_MAX="$LC_PRICE_MAX" \
        --env LC_BRANCH_PROPERTY_ID="$LC_BRANCH_PROPERTY_ID" \
        --env LC_BRANCH_PROPERTY_TITLE="$LC_BRANCH_PROPERTY_TITLE" \
        --env LC_RENT="$LC_RENT" --env LC_DEPOSIT="$LC_DEPOSIT" \
        --env LC_HOLDING_DEPOSIT="$LC_HOLDING_DEPOSIT" --env LC_HOLDING_DEPOSIT_TEXT="$LC_HOLDING_DEPOSIT_TEXT" 2>&1 | tee "log-$attempt.txt" | tee log.txt )
    status=$?
    kill "$watchdog" 2>/dev/null
    if grep -q "Exception in thread" "$OUT/$name/log.txt" && ! grep -q "\.\.\. FAILED" "$OUT/$name/log.txt"; then
      echo "↻ $name: Maestro driver crashed (attempt $attempt) — retrying"
      restart_app
      sleep 3
      continue
    fi
    break
  done
  if [[ $status -ne 0 ]] || grep -q "FAILED\|Exception in thread" "$OUT/$name/log.txt"; then FAIL+=("$name"); else PASS+=("$name"); fi
done
echo; echo "Passed (${#PASS[@]}): ${PASS[*]:-}"; echo "Failed (${#FAIL[@]}): ${FAIL[*]:-}"
echo "Output: $OUT"
exit ${#FAIL[@]}
