#!/usr/bin/env bash
# Record a new test BY USING THE APP — Maestro writes the YAML from your taps/types.
# Usage: ./scripts/record-e2e.sh .maestro/flows/my-new-flow.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Install Maestro: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

if [[ -z "$OUT" ]]; then
  echo "Usage: $0 .maestro/flows/my-flow.yaml"
  exit 1
fi

mkdir -p "$(dirname "$ROOT/$OUT")"
echo "▶ Use the app normally — Maestro records taps and typing"
echo "  Output: $OUT"
echo ""

cd "$ROOT"
maestro record "$OUT"
