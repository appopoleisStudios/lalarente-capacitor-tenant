#!/usr/bin/env bash
# Run all client feedback Sheet 2 Maestro flows (tenant + owner).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/run-e2e.sh" "$ROOT/.maestro/flows/client-feedback-suite.yaml"
