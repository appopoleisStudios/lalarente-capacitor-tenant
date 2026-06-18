# Shared helpers for Maestro video scripts — avoid cluttering qa-videos/ on failed runs.
#
# Policy: record into a temp dir; promote to qa-videos/<name>-<stamp>/ only when
# every flow succeeds. Optional pre-flight `maestro test` skips recording entirely
# when tests are red.
#
# Env overrides:
#   E2E_VIDEO_TEST_FIRST=0     skip pre-flight test (record only)
#   E2E_KEEP_FAILED_VIDEOS=1   keep temp dir when a recording fails (debug)

e2e_video_maybe_test_first() {
  local test_cmd="$1"
  if [[ "${E2E_VIDEO_TEST_FIRST:-1}" == "1" ]]; then
    echo ""
    echo "▶ Pre-flight: running tests without recording…"
    if ! eval "$test_cmd"; then
      echo ""
      echo "Tests failed — no videos recorded (qa-videos/ unchanged)."
      echo "Fix flows or QA data, then re-run. Set E2E_VIDEO_TEST_FIRST=0 to skip this check."
      exit 1
    fi
    echo "▶ All tests passed — starting screen recordings…"
  fi
}

e2e_video_init_temp() {
  local parent="$1"
  local prefix="$2"
  E2E_VIDEO_TEMP="$(mktemp -d "$parent/.tmp-${prefix}-XXXXXX")"
  trap e2e_video_cleanup_temp EXIT
}

e2e_video_cleanup_temp() {
  if [[ -n "${E2E_VIDEO_TEMP:-}" && -d "$E2E_VIDEO_TEMP" ]]; then
    rm -rf "$E2E_VIDEO_TEMP"
  fi
}

# Call when all recordings succeeded — moves temp → final dir and clears trap.
e2e_video_promote() {
  local final_dir="$1"
  mkdir -p "$(dirname "$final_dir")"
  mv "$E2E_VIDEO_TEMP" "$final_dir"
  E2E_VIDEO_TEMP=""
  trap - EXIT
}

# Call when one or more recordings failed.
e2e_video_discard_or_keep() {
  local failed_count="$1"
  if [[ "$failed_count" -eq 0 ]]; then
    return 0
  fi
  echo ""
  if [[ "${E2E_KEEP_FAILED_VIDEOS:-}" == "1" ]]; then
    echo "$failed_count flow(s) failed — debug videos kept at: $E2E_VIDEO_TEMP"
    E2E_VIDEO_TEMP=""
    trap - EXIT
  else
    echo "$failed_count flow(s) failed — discarding recordings (qa-videos/ unchanged)."
    echo "Set E2E_KEEP_FAILED_VIDEOS=1 to keep partial videos for debugging."
  fi
  return 1
}
