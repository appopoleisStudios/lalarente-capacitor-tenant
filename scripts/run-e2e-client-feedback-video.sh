#!/usr/bin/env bash
# Record MP4 videos for client feedback sign-off — only kept when ALL flows pass.
# 1) Pre-flight maestro test (no video) — exit early if red
# 2) Record into temp dir — promote to qa-videos/client-feedback-<stamp>/ on full green
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.maestro/.env"
STAMP="$(date +%Y%m%d-%H%M%S)"
FINAL_DIR="$ROOT/qa-videos/client-feedback-$STAMP"

# shellcheck source=lib/resolve-maestro.sh
source "$ROOT/scripts/lib/resolve-maestro.sh"
# shellcheck source=lib/e2e-video-retention.sh
source "$ROOT/scripts/lib/e2e-video-retention.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Copy .maestro/.env.example → .maestro/.env and set QA credentials."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for var in TENANT_EMAIL TENANT_PASSWORD OWNER_EMAIL OWNER_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set $var in .maestro/.env"
    exit 1
  fi
done

cd "$ROOT"
mkdir -p "$ROOT/qa-videos"

e2e_video_maybe_test_first "bash \"$ROOT/scripts/run-e2e-client-feedback.sh\""

e2e_video_init_temp "$ROOT/qa-videos" "client-feedback"
TENANT_DIR="$E2E_VIDEO_TEMP/tenant"
OWNER_DIR="$E2E_VIDEO_TEMP/owner"
mkdir -p "$TENANT_DIR" "$OWNER_DIR"

ENV_ARGS=(
  --env "TENANT_EMAIL=$TENANT_EMAIL"
  --env "TENANT_PASSWORD=$TENANT_PASSWORD"
  --env "OWNER_EMAIL=$OWNER_EMAIL"
  --env "OWNER_PASSWORD=$OWNER_PASSWORD"
)

TENANT_FLOWS=(
  "01-tenant-dashboard.yaml|S2-24 dashboard+lease"
  "client-feedback/s2-25-tenant-bell.yaml|S2-25 bell"
  "17-pr11-tenant-viewings-applications.yaml|S2-43-44 viewings+apps"
  "05-pr7-tenant-tenancy-shortcuts.yaml|S2-76-78 tenancy shortcuts"
  "06-pr7-tenant-disputes-empty.yaml|S2-77 disputes"
  "08-pr9-tenant-inspections.yaml|S2-41-42 inspections"
  "03-tenant-maintenance.yaml|S2-35-37 maintenance"
  "11-pr10-tenant-maintenance-message.yaml|S2-39 maint messages"
  "12-pr10-tenant-messaging-keyboard.yaml|S2-10-15-38 keyboard"
  "client-feedback/s2-40-tenant-send-message.yaml|S2-40 send message"
  "13-pr10-tenant-lease-pdf.yaml|S2-24-30 lease PDF"
  "client-feedback/s2-26-tenant-profile-docs.yaml|S2-26-28 profile PDF"
  "client-feedback/s2-31-tenant-contact-owner.yaml|S2-31 contact owner"
  "client-feedback/s2-32-tenant-payments.yaml|S2-32-33 payments"
  "14-pr10-tenant-maintenance-camera.yaml|S2-36 maintenance camera"
  "07-pr7-tenant-application-pdf.yaml|T7 application PDF"
  "02-tenant-lala-ai.yaml|Lala AI tenant"
)

OWNER_FLOWS=(
  "client-feedback/s2-01-owner-dashboard.yaml|S2-01 dashboard"
  "client-feedback/s2-02-owner-bell.yaml|S2-02 bell"
  "18-pr11-owner-applications.yaml|S2-05 applications"
  "client-feedback/s2-03-owner-viewings.yaml|S2-03-04 viewings"
  "client-feedback/s2-08-owner-leases.yaml|S2-08 leases"
  "client-feedback/s2-10-owner-lease-messages.yaml|S2-10-15 lease messages"
  "client-feedback/s2-11-owner-rent-roll.yaml|S2-11-12 rent roll"
  "client-feedback/s2-13-owner-maintenance.yaml|S2-13-14 maintenance vendors"
  "09-pr9-owner-inspection-conduct.yaml|S2-17-18 inspection conduct"
  "10-pr9-owner-inspection-readonly.yaml|S2-17 readonly inspection"
  "client-feedback/s2-19-owner-messages.yaml|S2-19-20 messages"
  "client-feedback/s2-21-owner-property.yaml|S2-21 property photos"
  "15-pr7-owner-disputes-empty.yaml|S2-26 owner disputes"
  "16-pr6-owner-lala-ai.yaml|Lala AI owner"
)

record_group() {
  local dir="$1"
  shift
  local -a flows=("$@")
  local failed=0
  local concat="$dir/concat.txt"
  : > "$concat"
  local idx=0

  for entry in "${flows[@]}"; do
    local flow="${entry%%|*}"
    local label="${entry#*|}"
    local base
    base="$(basename "$flow" .yaml)"
    local out_mp4="$dir/${base}.mp4"
    local src="$ROOT/.maestro/flows/$flow"
    local record_flow="$src"
    local tmp_flow=""

    # After the first clip, keep the signed-in session (clearState per flow breaks record mode login).
    if [[ "$idx" -gt 0 ]]; then
      tmp_flow="$(mktemp "$E2E_VIDEO_TEMP/.flow-XXXXXX.yaml")"
      sed 's|subflows/launch-app\.yaml|subflows/launch-app-warm.yaml|g' "$src" > "$tmp_flow"
      record_flow="$tmp_flow"
    fi

    echo ""
    echo "▶ [$label] Recording $flow"
    if "$MAESTRO_BIN" record --local "${ENV_ARGS[@]}" "$record_flow" "$out_mp4"; then
      echo "  ✓ $label"
      printf "file '%s'\n" "$out_mp4" >> "$concat"
    else
      echo "  ✗ $label"
      failed=$((failed + 1))
    fi

    [[ -n "$tmp_flow" ]] && rm -f "$tmp_flow"
    idx=$((idx + 1))
  done

  local demo="$dir/client-signoff-demo.mp4"
  if command -v ffmpeg >/dev/null 2>&1 && [[ -s "$concat" ]]; then
    ffmpeg -y -f concat -safe 0 -i "$concat" -c copy "$demo" 2>/dev/null || true
  fi
  return "$failed"
}

echo ""
echo "▶ Client feedback video recording (temp until all pass)"
echo "  Final output (on success): $FINAL_DIR"

TENANT_FAILED=0
OWNER_FAILED=0
record_group "$TENANT_DIR" "${TENANT_FLOWS[@]}" || TENANT_FAILED=$?
record_group "$OWNER_DIR" "${OWNER_FLOWS[@]}" || OWNER_FAILED=$?

TOTAL=$((TENANT_FAILED + OWNER_FAILED))
if ! e2e_video_discard_or_keep "$TOTAL"; then
  exit 1
fi

cat > "$E2E_VIDEO_TEMP/README.txt" <<EOF
Lalarente client feedback sign-off videos
Generated: $STAMP

tenant/  — tenant QA account — Sheet 2 steps S2-24 … S2-44
owner/   — owner QA account — Sheet 2 steps S2-01 … S2-23

Send client-signoff-demo.mp4 in each folder, or individual clips by S2 label.
EOF

e2e_video_promote "$FINAL_DIR"

echo ""
echo "All flows recorded — videos saved under: $FINAL_DIR"
