#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/laufey-checkout" >&2
  exit 2
fi
if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo "This build recipe currently supports macOS arm64." >&2
  exit 2
fi

FATHOM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FATHOM_BACKEND="$(cd "$1" && pwd)"
FATHOM_PIN=1fe87874288e8359fa3de04d18cc14f56957b000
FATHOM_PATCH="$FATHOM_ROOT/app/native/laufey-0.7.0.patch"
FATHOM_CEF="$FATHOM_BACKEND/vendor/cef/149.0.5+g6770623+chromium-149.0.7827.197/macosarm64/install"

if [[ "$(git -C "$FATHOM_BACKEND" rev-parse HEAD)" != "$FATHOM_PIN" ]]; then
  echo "Expected Laufey v0.7.0 at $FATHOM_PIN." >&2
  exit 1
fi
if [[ ! -f "$FATHOM_CEF/libcef_dll_wrapper/libcef_dll_wrapper.a" ]]; then
  echo "Prepare the pinned CEF dependency first; see docs/guides/native-browser-development.md." >&2
  exit 1
fi
command -v cmake >/dev/null
command -v ninja >/dev/null

if git -C "$FATHOM_BACKEND" apply --reverse --check "$FATHOM_PATCH" 2>/dev/null; then
  echo "Fathom backend patch is already applied."
elif git -C "$FATHOM_BACKEND" apply --check "$FATHOM_PATCH"; then
  git -C "$FATHOM_BACKEND" apply "$FATHOM_PATCH"
else
  echo "The backend patch cannot be applied cleanly. Preserve and inspect local changes before retrying." >&2
  exit 1
fi

cmake -G Ninja -B "$FATHOM_BACKEND/cef/build" -S "$FATHOM_BACKEND/cef" \
  -DCMAKE_BUILD_TYPE=Release \
  -DPROJECT_ARCH=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  "-DCEF_ROOT=$FATHOM_CEF" \
  "-DFATHOM_NATIVE_DIR=$FATHOM_ROOT/app/native"
cmake --build "$FATHOM_BACKEND/cef/build"
cp "$FATHOM_BACKEND/cef/build/Release/fathom_child_ffi.dylib" \
  "$FATHOM_ROOT/app/native/fathom_child_ffi.dylib"

echo "Backend built and FFI library staged."
echo "Package with LAUFEY_DEV_DIR=$FATHOM_BACKEND using script/build_and_run.sh after active app runs finish."
