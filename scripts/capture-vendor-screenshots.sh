#!/bin/bash
# Vendor Screenshot Capture Script
# Uses Maestro for login and xcrun simctl for reliable screenshot captures
set -e

OUTPUT_DIR="/tmp/vendor-screenshots-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "=== Vendor Screenshot Capture ==="
echo "Output: $OUTPUT_DIR"

# Source environment variables
source .maestro/.env 2>/dev/null || true

SCREENSHOT() {
  local name="$1"
  local file="$OUTPUT_DIR/${name}.png"
  xcrun simctl io booted screenshot "$file" 2>/dev/null
  if [ -f "$file" ]; then
    local size
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "?")
    echo "  ✅ Captured: ${name}.png ($size bytes)"
  else
    echo "  ❌ FAILED: ${name}.png"
  fi
}

APP_BUNDLE="com.lalarente.app"

# ============================================================
# Step 1: Kill any existing app instance and launch fresh
# ============================================================
echo ""
echo "--- Step 1: Launching app ---"
xcrun simctl terminate "$APP_BUNDLE" 2>/dev/null || true
sleep 2
xcrun simctl launch "$APP_BUNDLE" 2>/dev/null
echo "  App launched, waiting 50s for cold start + Metro bundle + auth check..."
sleep 50
SCREENSHOT "01-launch-screen"

# ============================================================
# Step 2: Use Maestro to login as vendor
# ============================================================
echo ""
echo "--- Step 2: Vendor login via Maestro ---"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
set +e
maestro test .maestro/flows/vendor-dashboard.yaml \
  --env VENDOR_EMAIL="$VENDOR_EMAIL" \
  --env VENDOR_PASSWORD="$VENDOR_PASSWORD" \
  --env TENANT_EMAIL="$TENANT_EMAIL" \
  --env TENANT_PASSWORD="$TENANT_PASSWORD" \
  --env OWNER_EMAIL="$OWNER_EMAIL" \
  --env OWNER_PASSWORD="$OWNER_PASSWORD" 2>&1
MAESTRO_EXIT=$?
set -e

if [ $MAESTRO_EXIT -ne 0 ]; then
  echo "  ⚠️ Maestro login flow exited with code $MAESTRO_EXIT"
  echo "  Screenshots may show login screen instead of dashboard"
else
  echo "  ✅ Maestro login flow completed successfully"
fi

# Wait for app to settle after Maestro
sleep 5
SCREENSHOT "02-vendor-dashboard"

# ============================================================
# Step 3: Navigate to each screen and capture
# ============================================================
echo ""
echo "--- Step 3: Capturing vendor screens ---"

# Helper: navigate and screenshot
NAV_AND_CAPTURE() {
  local route="$1"
  local name="$2"
  echo "  Navigating to $route..."
  xcrun simctl openurl booted "lalarenteapp:///(vendor)/${route}" 2>/dev/null || true
  sleep 6
  SCREENSHOT "$name"
}

NAV_AND_CAPTURE "maintenance" "03-vendor-maintenance-requests"
NAV_AND_CAPTURE "jobs" "04-vendor-my-jobs"
NAV_AND_CAPTURE "contracts" "05-vendor-contracts"
NAV_AND_CAPTURE "ai-chat" "06-vendor-ai-chat"
NAV_AND_CAPTURE "profile" "07-vendor-profile"

# Notifications - go to dashboard first, then tap bell
echo "  Navigating to dashboard for notifications..."
xcrun simctl openurl booted "lalarenteapp:///(vendor)/dashboard" 2>/dev/null || true
sleep 6
SCREENSHOT "08-vendor-dashboard"

# Open notifications (bell screen)
xcrun simctl openurl booted "lalarenteapp:///(vendor)/notifications" 2>/dev/null || true
sleep 6
SCREENSHOT "09-vendor-notifications"

# Messages
NAV_AND_CAPTURE "messages" "10-vendor-messages"

# ============================================================
# Step 4: Verify results - check for duplicates
# ============================================================
echo ""
echo "=== Results ==="
ls -la "$OUTPUT_DIR"/*.png 2>/dev/null
echo ""
echo "Total screenshots: $(ls "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l)"

echo ""
echo "=== Uniqueness check ==="
if command -v md5sum &>/dev/null; then
  for f in "$OUTPUT_DIR"/*.png; do
    md5sum "$f" | cut -d' ' -f1
  done | sort | uniq -c | sort -rn
elif command -v md5 &>/dev/null; then
  for f in "$OUTPUT_DIR"/*.png; do
    md5 -r "$f" | cut -d' ' -f1
  done | sort | uniq -c | sort -rn
else
  echo "  No md5/md5sum tool available, skipping"
fi

echo ""
echo "=== Done ==="
echo "Screenshots saved to: $OUTPUT_DIR"
