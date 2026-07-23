#!/usr/bin/env bash
# Mac Mini: PRODUCTION READINESS PIPELINE
# 1) Starts Metro (if not running)
# 2) Warms simulator bundle
# 3) Runs ALL 38 flows across tenant→owner→vendor with fresh install between phases
# 4) Records sign-off video on full green
#
# Prerequisites:
#   - iPhone simulator booted
#   - .env (Supabase keys) + .maestro/.env (QA credentials)
#   - Dev build installed (npx expo run:ios)
#   - Source: source .maestro/.env
#
# Usage:
#   source .maestro/.env && bash scripts/run-e2e-macmini-pipeline.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.nvm/versions/node/v24.4.1/bin:${HOME}/.maestro/bin:/opt/homebrew/bin:${PATH:-}"

LOG="/tmp/maestro-pipeline.log"
: > "$LOG"

log() { echo "$*" | tee -a "$LOG"; }

# ── Pre-flight: simulator booted + app installed ──
if ! xcrun simctl list devices 2>/dev/null | grep -q Booted; then
  log "❌ No booted simulator — open Simulator app and boot a device first"
  exit 1
fi
if ! xcrun simctl listapps booted 2>/dev/null | grep -q com.lalarente.app; then
  log "❌ App not installed on simulator — run: npx expo run:ios"
  exit 1
fi

# ── Auto-source credentials ──
if [[ ! -f "$ROOT/.maestro/.env" ]]; then
  log "❌ Missing .maestro/.env — run: cp .maestro/.env.example .maestro/.env"
  exit 1
fi
set -a; source "$ROOT/.maestro/.env"; set +a

# ── Verify credentials (reject placeholder values) ──
for var in TENANT_EMAIL TENANT_PASSWORD OWNER_EMAIL OWNER_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD; do
  if [[ -z "${!var:-}" || "${!var:-}" == "<from team vault>" ]]; then
    log "❌ Set $var in .maestro/.env (replace '<from team vault>' with actual credentials)"
    exit 1
  fi
done

# ── Free disk if Maestro artifacts are huge ──
if df -h /System/Volumes/Data 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); if ($5+0 > 95) exit 1}'; then
  log "▶ Disk >95% — clearing Maestro test artifacts"
  rm -rf "${HOME}/.maestro/tests/"* 2>/dev/null || true
fi

# ── Start Metro if not running ──
if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
  log "▶ Starting Metro with .env"
  nohup bash "$ROOT/scripts/start-metro-e2e.sh" >> /tmp/metro.log 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf http://localhost:8081/status >/dev/null 2>&1 && break
    sleep 2
  done
fi

# ── Warm simulator ──
log "▶ Warming simulator bundle..."
bash "$ROOT/scripts/warm-e2e-simulator.sh" >> "$LOG" 2>&1

# ── RUN ALL 38 FLOWS across tenant→owner→vendor ──
log "▶ START: Full E2E suite ($(date))"

if bash "$ROOT/scripts/run-full-e2e-suite.sh" >> "$LOG" 2>&1; then
  log "▶ ALL 38 FLOWS GREEN $(date)"
  
  # Record sign-off video on success
  E2E_VIDEO_TEST_FIRST=0 npm run test:e2e:client-feedback:video >> "$LOG" 2>&1
  log "▶ VIDEO EXIT:$? $(date)"
  find "$ROOT/qa-videos" -name 'client-signoff-demo.mp4' 2>/dev/null | tee -a "$LOG"
  exit 0
fi

# ── FAILURE ──
log "▶ SUITE FAILED $(date)"
log "▶ Check: $LOG for details"
log "▶ Failed flows:"
grep 'FAILED' "$LOG" | tail -20 | tee -a "$LOG"
exit 1
