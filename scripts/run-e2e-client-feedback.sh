#!/usr/bin/env bash
# Run all client feedback Sheet 2 Maestro flows (tenant + owner).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/warm-e2e-simulator.sh"
exec bash "$ROOT/scripts/run-e2e.sh" "$ROOT/.maestro/flows/client-feedback-suite.yaml"
