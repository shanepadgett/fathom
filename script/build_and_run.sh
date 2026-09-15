#!/usr/bin/env bash
set -euo pipefail

FATHOM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FATHOM_BUNDLE="$FATHOM_ROOT/app/dist/Fathom.app"
FATHOM_MODE="${1:-run}"
case "$FATHOM_MODE" in
  run|--debug|--logs|--telemetry|--verify) ;;
  *) echo "Usage: $0 [run|--debug|--logs|--telemetry|--verify] [--env NAME=value ...]" >&2; exit 2 ;;
esac
if [[ $# -gt 0 ]]; then shift; fi
FATHOM_EXTRA_LAUNCH_ARGS=()
while [[ $# -gt 0 ]]; do
  if [[ "$1" != "--env" || $# -lt 2 || ! "$2" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    echo "Expected --env NAME=value after the launch mode." >&2
    exit 2
  fi
  FATHOM_EXTRA_LAUNCH_ARGS+=(--env "$2")
  shift 2
done

cd "$FATHOM_ROOT/app"
FATHOM_DEBUG_ARGS=()
if [[ "$FATHOM_MODE" == "--debug" ]]; then
  FATHOM_DEBUG_ARGS+=(--inspect-renderer=127.0.0.1:9444)
fi
mise exec -- deno run -A scripts/build-desktop.ts "${FATHOM_DEBUG_ARGS[@]}"

FATHOM_LOG_DIR="${FATHOM_HOME:-$HOME/.fathom}/logs"
mkdir -p "$FATHOM_LOG_DIR"
FATHOM_LAUNCH_ARGS=(--env "FATHOM_HOME=${FATHOM_HOME:-$HOME/.fathom}" --env "FATHOM_WORKSPACE=${FATHOM_WORKSPACE:-$FATHOM_ROOT}")
FATHOM_RUNTIME="${FATHOM_DENO:-$(mise which deno)}"
FATHOM_LAUNCH_ARGS+=(--env "FATHOM_DENO=$FATHOM_RUNTIME")
if [[ -n "${FATHOM_PI_AUTH:-}" ]]; then FATHOM_LAUNCH_ARGS+=(--env "FATHOM_PI_AUTH=$FATHOM_PI_AUTH"); fi
if [[ -n "${FATHOM_PORT:-}" ]]; then FATHOM_LAUNCH_ARGS+=(--env "FATHOM_PORT=$FATHOM_PORT"); fi
/usr/bin/open -n "$FATHOM_BUNDLE" "${FATHOM_LAUNCH_ARGS[@]}" "${FATHOM_EXTRA_LAUNCH_ARGS[@]}" \
  --stdout "$FATHOM_LOG_DIR/desktop.log" --stderr "$FATHOM_LOG_DIR/desktop-error.log"
if [[ "$FATHOM_MODE" == "--logs" || "$FATHOM_MODE" == "--telemetry" ]]; then
  tail -f "$FATHOM_LOG_DIR/desktop.log" "$FATHOM_LOG_DIR/desktop-error.log"
elif [[ "$FATHOM_MODE" == "--verify" ]]; then
  for attempt in {1..30}; do
    if pgrep -f "$FATHOM_BUNDLE/Contents/MacOS/" >/dev/null; then exit 0; fi
    sleep 1
  done
  echo "Desktop process did not start. See $FATHOM_LOG_DIR/desktop-error.log" >&2
  exit 1
fi
