# Native browser development

The native child-browser extension is under development. The normal desktop
build still uses the existing browser implementation until the extension and
frontend integration have been exercised together.

## Pinned backend

Use Laufey **v0.7.0**, commit
`1fe87874288e8359fa3de04d18cc14f56957b000`, with CEF
`149.0.5+g6770623+chromium-149.0.7827.197`. Keep the checkout outside the Fathom
repository. Native extension sources belong under `app/native/`; generated
backend files and CEF downloads belong in the external checkout.

The macOS arm64 minimal CEF archive used for the initial build has SHA-256:

```text
8711929a205d3564ab9993defc586bd51f23a20a9a7249a9de8846d7864cc463
```

Its SHA-1 matches the checksum published alongside the archive by the CEF build
service. Other platforms need their own verified archive and build evidence.

## Build dependencies

Install CMake and Ninja and make them available on `PATH`. The initial macOS
build used CMake 4.4.3, Ninja 1.13.2 and Apple Clang 21 from the installed Xcode
toolchain. No Rust runtime rebuild is needed for this CEF backend increment.

In the pinned Laufey checkout:

```sh
make cef-deps
cmake -G Ninja -B cef/build -S cef \
  -DCMAKE_BUILD_TYPE=Release \
  -DPROJECT_ARCH=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  "-DCEF_ROOT=$PWD/vendor/cef/149.0.5+g6770623+chromium-149.0.7827.197/macosarm64/install"
ninja -C cef/build
```

`make cef-deps` downloads the archive and builds the CEF wrapper. Check the
download against the pinned checksum before treating a new download as trusted
build input. The commands above establish the upstream build; the repository's
native extension must also be integrated before it exposes child-browser APIs.

From the Fathom repository, build the extension with:

```sh
script/build_native_browser.sh /absolute/path/to/laufey
```

The script validates the pinned commit and prepared CEF wrapper, applies the
repository patch (or recognizes it already applied), and builds the backend.
It stages `fathom_child_ffi.dylib` under `app/native/` for the shared desktop
builder to sign and package. It does not restart the running app. Keep CMake
and Ninja on `PATH`. This recipe currently supports macOS arm64 only.

## Package through Fathom

Deno 2.9.6 supports `LAUFEY_DEV_DIR` to select a locally built backend. Point it
at the checkout, not at the executable. It recognizes
`cef/build/Release/laufey.app`.

Once no Fathom agent run is active, build from the Fathom repository:

```sh
LAUFEY_DEV_DIR=/absolute/path/to/laufey \
  FATHOM_HOME=/absolute/path/to/development-profile \
  script/build_and_run.sh --debug
```

Continue using the shared Fathom builder: it retains the configured signing
identity and applies the runtime entitlements. Do not launch an ad-hoc copy as a
replacement for the signed Fathom app. See [desktop development](desktop-development.md).

The backend uses the explicit `BrowserWindow.windowId` as parent identity.
`getNativeWindow()` is a WebGPU surface API, not a native child-view handle.
Project/session state stays in Cordis; native code owns view resources and UI
thread operations. The [delivery audit](../technical/delivery-audit.md) lists the
required integration checks, including modal layering, page isolation and cleanup.

## Source references

- [Laufey build recipe](https://github.com/littledivy/laufey/blob/1fe87874288e8359fa3de04d18cc14f56957b000/Makefile)
- [Deno backend selection](https://github.com/denoland/deno/blob/v2.9.6/cli/tools/desktop.rs)
- [Deno desktop types](https://github.com/denoland/deno/blob/v2.9.6/cli/tsc/dts/lib.deno.desktop.d.ts)
