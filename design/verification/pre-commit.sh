#!/bin/sh
set -eu
cd "$(git rev-parse --show-toplevel)"
deno fmt AGENTS.md docs/standards docs/technical/component-architecture.md docs/technical/design-system.md docs/technical/tracker.md
cd design
deno fmt
deno task check
deno task build
if [ "${FATHOM_VERIFY_BROWSER:-0}" != "0" ]; then
  python3 verification/browser.py
fi
