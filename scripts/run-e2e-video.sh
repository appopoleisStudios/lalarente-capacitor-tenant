#!/usr/bin/env bash
# Record MP4 videos of each Build 5 UI test (human-visible taps/types on simulator).
# Output: qa-videos/<timestamp>/ — send folder or build5-client-demo.mp4 to client.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.maestro/.env"
OUT_DIR="$ROOT/qa-videos/$(date +%Y%m%d-%H%M%S)"

# shellcheck source=lib/resolve-maestro.sh
source "$ROOT/scripts/lib/resolve-maestro.sh"

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

mkdir -p "$OUT_DIR"
cd "$ROOT"

# Ordered for client demo narrative (tenant fixes → owner fixes)
FLOWS=(
  "01-tenant-dashboard.yaml"
  "05-pr7-tenant-tenancy-shortcuts.yaml"
  "06-pr7-tenant-disputes-empty.yaml"
  "08-pr9-tenant-inspections.yaml"
  "03-tenant-maintenance.yaml"
  "11-pr10-tenant-maintenance-message.yaml"
  "12-pr10-tenant-messaging-keyboard.yaml"
  "13-pr10-tenant-lease-pdf.yaml"
  "14-pr10-tenant-maintenance-camera.yaml"
  "02-tenant-lala-ai.yaml"
  "07-pr7-tenant-application-pdf.yaml"
  "04-owner-dashboard.yaml"
  "09-pr9-owner-inspection-conduct.yaml"
  "10-pr9-owner-inspection-readonly.yaml"
  "15-pr7-owner-disputes-empty.yaml"
  "16-pr6-owner-lala-ai.yaml"
)

ENV_ARGS=(
  --env "TENANT_EMAIL=$TENANT_EMAIL"
  --env "TENANT_PASSWORD=$TENANT_PASSWORD"
  --env "OWNER_EMAIL=$OWNER_EMAIL"
  --env "OWNER_PASSWORD=$OWNER_PASSWORD"
)

FAILED=0
for flow in "${FLOWS[@]}"; do
  name="${flow%.yaml}"
  out_mp4="$OUT_DIR/${name}.mp4"
  echo ""
  echo "▶ Recording $flow → $out_mp4"
  echo "  (Watch the simulator — Maestro taps and types visibly)"
  if "$MAESTRO_BIN" record --local "${ENV_ARGS[@]}" ".maestro/flows/$flow" "$out_mp4"; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name (see logs)"
    FAILED=$((FAILED + 1))
  fi
done

CONCAT_LIST="$OUT_DIR/concat.txt"
DEMO_MP4="$OUT_DIR/build5-client-demo.mp4"
if command -v ffmpeg >/dev/null 2>&1; then
  : > "$CONCAT_LIST"
  for flow in "${FLOWS[@]}"; do
    f="$OUT_DIR/${flow%.yaml}.mp4"
    if [[ -f "$f" ]]; then
      printf "file '%s'\n" "$f" >> "$CONCAT_LIST"
    fi
  done
  if [[ -s "$CONCAT_LIST" ]]; then
    ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$DEMO_MP4" 2>/dev/null || true
    if [[ -f "$DEMO_MP4" ]]; then
      echo ""
      echo "Combined demo: $DEMO_MP4"
    fi
  fi
else
  echo ""
  echo "Tip: install ffmpeg to auto-stitch clips into build5-client-demo.mp4"
fi

echo ""
echo "Videos saved under: $OUT_DIR"
if [[ "$FAILED" -gt 0 ]]; then
  echo "$FAILED flow(s) failed — re-run failed clips or fix QA data."
  exit 1
fi
echo "All flows recorded successfully."
