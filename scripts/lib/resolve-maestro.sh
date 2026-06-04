# Resolve Maestro CLI — installer puts it in ~/.maestro/bin, which npm/zsh often omit from PATH.
# Usage: source this file, then run "$MAESTRO_BIN" …

resolve_maestro_bin() {
  if [[ -n "${MAESTRO_BIN:-}" && -x "$MAESTRO_BIN" ]]; then
    echo "$MAESTRO_BIN"
    return 0
  fi

  if command -v maestro >/dev/null 2>&1; then
    command -v maestro
    return 0
  fi

  local candidates=(
    "${HOME}/.maestro/bin/maestro"
    "/opt/homebrew/bin/maestro"
    "/usr/local/bin/maestro"
  )

  local path
  for path in "${candidates[@]}"; do
    if [[ -x "$path" ]]; then
      echo "$path"
      return 0
    fi
  done

  return 1
}

MAESTRO_BIN="$(resolve_maestro_bin || true)"

if [[ -z "$MAESTRO_BIN" ]]; then
  echo "Maestro CLI not found."
  echo ""
  echo "Install:"
  echo "  curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  echo ""
  echo "Then add to PATH (zsh on Mac mini — required for npm scripts):"
  echo "  echo 'export PATH=\"\$PATH:\$HOME/.maestro/bin\"' >> ~/.zshrc"
  echo "  source ~/.zshrc"
  echo ""
  echo "Or run once in this terminal:"
  echo "  export PATH=\"\$PATH:\$HOME/.maestro/bin\""
  echo ""
  echo "Verify:  ~/.maestro/bin/maestro --version"
  echo "Or set:  export MAESTRO_BIN=\"\$HOME/.maestro/bin/maestro\""
  exit 1
fi

export MAESTRO_BIN
export PATH="$(dirname "$MAESTRO_BIN"):${PATH}"
