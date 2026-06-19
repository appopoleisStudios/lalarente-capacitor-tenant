#!/usr/bin/env bash
# Mac mini: full client-feedback Maestro suite → sign-off video on green.
# Prerequisites: iPhone simulator booted, .env + .maestro/.env, dev build installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.nvm/versions/node/v24.4.1/bin:${HOME}/.maestro/bin:/opt/homebrew/bin:${PATH:-}"

LOG="/tmp/maestro-pipeline.log"
: > "$LOG"

log() { echo "$*" | tee -a "$LOG"; }

# Free disk if Maestro artifacts are huge
if df -h /System/Volumes/Data 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); if ($5+0 > 95) exit 1}'; then
  log "▶ Disk >95% — clearing Maestro test artifacts"
  rm -rf "${HOME}/.maestro/tests/"* 2>/dev/null || true
fi

if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
  log "▶ Starting Metro with .env"
  nohup bash "$ROOT/scripts/start-metro-e2e.sh" >> /tmp/metro.log 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf http://localhost:8081/status >/dev/null 2>&1 && break
    sleep 2
  done
fi

log "▶ START $(date)"
bash "$ROOT/scripts/warm-e2e-simulator.sh" >> "$LOG" 2>&1

if npm run test:e2e:client-feedback >> "$LOG" 2>&1; then
  log "▶ SUITE GREEN $(date)"
  E2E_VIDEO_TEST_FIRST=0 npm run test:e2e:client-feedback:video >> "$LOG" 2>&1
  log "▶ VIDEO EXIT:$? $(date)"
  find "$ROOT/qa-videos" -name 'client-signoff-demo.mp4' 2>/dev/null | tee -a "$LOG"
  exit 0
fi

log "▶ SUITE FAILED $(date)"
grep -E 'FAILED|Assertion' "$LOG" | tail -10 | tee -a "$LOG"
exit 1
