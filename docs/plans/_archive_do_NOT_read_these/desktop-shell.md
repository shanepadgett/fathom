# Desktop shell

Fathom runs as a native desktop application built with `deno desktop`. The Deno
runtime owns the process, the window, and the plugin hosts. The page inside the
window is the same browser host that runs today; it becomes an implementation
detail, not the product. `deno run` still works and opens a browser tab. That
mode exists for Chrome DevTools and for CI-free checks, not as a deployment.

## Facts this plan rests on

Verified against Deno 2.9.7 on this machine and the Deno docs (Desktop apps,
Serving, Windows, Bindings, Menus, HMR, Backends, Distribution, Configuration):

| Fact | Consequence |
| --- | --- |
| `deno desktop` exists in 2.9.7 and is marked experimental. `Deno.BrowserWindow` is only defined inside a desktop run or a packaged binary; under `deno run` it is `undefined`. | Mode is detected from the runtime, not from a flag. |
| Under `deno desktop`, `Deno.serve()` ignores the passed port, binds to `DENO_SERVE_ADDRESS` (always loopback), and the initial window navigates to `http://127.0.0.1:<port>` once the listener is ready. | The host must derive its origin from the bound address, and the page cannot receive the launch token in the URL. |
| The first `new Deno.BrowserWindow()` adopts the initial window. `close` is preventable. The runtime exits when no windows remain and no tasks are pending. | Shutdown is driven from the window `close` event. |
| `win.bind(name, fn)` exposes `fn` to the page as `bindings.<name>()` returning a Promise with JSON arguments. | The page fetches the launch token through a binding. |
| Backends: `webview` (WKWebView / WebView2 / WebKitGTK, small, no DevTools) or `cef` (bundled Chromium, ~150 MB, DevTools). Selected per build. | Default `webview`. Browser mode remains the debugging surface. |
| `deno desktop --hmr <entry>` runs unpackaged, keeps the runtime and webview alive, and hot-swaps Deno modules. It does not build our UI. | Dev loop is `build:ui` then `deno desktop --hmr`. |
| Packaged binaries embed the module graph plus `--include` paths. Embedded files are read relative to `import.meta.dirname`. Non-analyzable dynamic imports must be `--include`d. Importing plugin sources copied to `~/.fathom` at runtime is not documented as supported. | Gate 1 below decides whether backend plugins ship as source or as bundles. |
| The earlier `deno-desktop` branch shipped this way (`Deno.BrowserWindow`, `Deno.serve`, CEF backend, `laufey` binary). | The approach is proven on this codebase's ancestor. |

Not verified yet: `Deno.realPath`, `Deno.copyFile`, and `Deno.readDir` against the
embedded virtual filesystem, and WKWebView rendering of `@starting-style`,
`transition-behavior: allow-discrete`, and `popover`. Both are gates below.

## Target structure

Two runtimes exist: the Deno process and the page inside its window. They cannot
share a bundle, and the kernel runs in both, so they are two packages. Nothing
else justifies a package boundary. Window code has one consumer and lives in the
application. Build and install scripts are tooling and leave the server package.

```text
apps/desktop/                The one application.
  main.ts                    Process entry: resolve paths, pick window or browser fallback.
  window.ts                  Adopt the initial window, menu, close → shutdown, launchToken binding.
  page/index.html            What the window loads (moved from apps/ui).
  page/main.tsx              Page bootstrap: obtain token, call the renderer (moved from apps/ui).
packages/
  sdk/                       The one published package. `.` contracts; `./ui` slots, client, controls, theme.
    src/ui/controls/         Was packages/ui/src. Imports solid-js only; CSS beside each control.
    src/ui/theme/            theme.css, fonts.css, base.css, typography.css, styles.css
    src/desktop.ts (new)     DesktopBindings; AppEnvironment gains shell.
  kernel/                    Plugin lifecycle (unchanged).
  server/                    Renamed from host-deno. Runs backend plugins, loopback HTTP, serves the page.
    boot.ts                  Returns { kernel, launchToken, origin, close }.
    transport.ts             listen(handle, port?) binds and reports the real address.
    bridge.ts                Takes origin from transport, not from configured port.
    static.ts                Serves embedded or on-disk dist/ without realPath.
    open-browser.ts          open / xdg-open / cmd start for browser mode (moved out of main.ts).
  renderer/                  Renamed from host-browser. Runs inside the page, loads UI plugins, renders.
    launch-token.ts (new)    readLaunchToken(): bindings → hash → sessionStorage.
    boot.ts                  Unchanged contract.
scripts/
  build-ui.ts                Was packages/host-deno/build.ts.
  install-plugin.ts          Was packages/host-deno/install.ts.
deno.json                    desktop block; tasks dev / dev:browser / desktop:build; workspace and import names updated.
```

Rules that hold after the change:

- `server` never touches `Deno.BrowserWindow`. It returns `origin` and accepts a
  `launchToken`; who displays or binds them is the caller's concern.
- `apps/desktop/window.ts` is the only file that touches window, menu, or
  bindings. It has no HTTP handling and no plugin knowledge.
- `renderer` learns one thing: where a token may come from. It does not know
  whether it runs in a webview.
- `apps/desktop` is the only composition root. `apps/ui` is deleted; its two
  files were never an application, only the page this process serves.
- `DesktopBindings` in the SDK is the one shared type between `window.ts`
  (implementer) and `renderer` (caller). Plugins do not call bindings in this
  plan.
- Package names describe what the code is. The plugin vocabulary `backend` and
  `ui` stays in manifests, kernel names, and composition keys.
- Package names describe what the code is, not the plugin jargon for it. The
  plugin vocabulary `backend` and `ui` stays in manifests, kernel names, and
  composition keys.

## Call graphs

### Today (two directories under apps/, one of them misnamed)

```text
deno task dev
└─ apps/desktop/main.ts --browser
   ├─ Deno.stat dist/app/index.html
   ├─ server boot({home, resources, port})
   │  ├─ CompositionStore.load
   │  ├─ new Kernel("backend", DenoLoader)
   │  ├─ kernel.provide(AppEnvironment{…, launchToken})
   │  ├─ discover(resources, home)
   │  ├─ bridge(kernel, {port, launchToken}, state, catalog)
   │  │  └─ listen(port, handle)  →  Deno.serve({hostname, port})
   │  │       handle: /api/* (Bearer token) | serveStatic(dist/app, dist/plugins)
   │  └─ kernel.start()
   ├─ console.log(url#token)
   └─ Deno.Command("open", url)
        └─ browser loads index.html → app.js → apps/ui/main.tsx   (this is the window page, not an app)
             ├─ read #token, stash in sessionStorage
             └─ bootBrowser(root, token) → BrowserClient(fetch, SSE) → kernel("ui")
```

### Target, native

```text
deno task dev            = build:ui && deno desktop --hmr apps/desktop/main.ts
deno task desktop:build  = deno desktop … -o dist/Fathom.app apps/desktop/main.ts
└─ apps/desktop/main.ts
   ├─ resolvePaths()                        home, resources (import.meta.dirname/../..)
   ├─ desktopRuntime()                      → defined
   └─ apps/desktop/window.ts  openDesktop({home, resources})
      ├─ adoptMainWindow({title, width, height})   new Deno.BrowserWindow (adopts initial)
      │  └─ window.hide()                            no flash before the host is ready
      ├─ window.bind("launchToken", () => token)    token minted here, passed into boot
      ├─ server boot({home, resources, launchToken})
      │  ├─ … as today …
      │  ├─ bridge → listen(handle)  →  Deno.serve(handle)   port ignored; runtime binds loopback
      │  │     origin = from server.addr                    used for host/origin checks
      │  └─ kernel.start()
      ├─ runtime navigates window to origin once listening (automatic)
      │    page: apps/desktop/page/main.tsx → readLaunchToken() → bindings.launchToken() → bootBrowser
      ├─ window.setApplicationMenu(applicationMenu({ devtools: backend === "cef" }))
      ├─ window.addEventListener("menuclick", dispatch)     reload | devtools | quit
      ├─ window.addEventListener("close", e => { e.preventDefault(); shutdown() })
      ├─ Deno.addSignalListener(SIGINT|SIGTERM, shutdown)
      ├─ window.show()
      └─ shutdown(): once → host.close() → window.close()   runtime exits: no windows, no tasks
```

### Target, browser fallback

```text
deno task dev:browser    = build:ui && deno run -A … apps/desktop/main.ts
└─ apps/desktop/main.ts
   ├─ resolvePaths()
   ├─ desktopRuntime()                      → undefined
   └─ server boot({home, resources, launchToken, port: FATHOM_PORT ?? 5173})
      ├─ … identical …
      └─ main prints `${origin}/#token=…`, opens it unless --no-open
           page: readLaunchToken() → bindings absent → hash → sessionStorage
```

### Token and origin flow

```text
mint token ─────────────┐
                        ▼
server boot ─── provides AppEnvironment{launchToken, shell}
     │            bridge checks Authorization: Bearer <token> on /api/*
     │            bridge checks Host and Origin against origin from server.addr
     ▼
apps/desktop/window.ts ── window.bind("launchToken") ──▶ page: bindings.launchToken()
apps/desktop ──── prints url#token (browser mode) ──▶ page: location.hash
```

## Work

Each step ends with `mise run lint:fix`, `mise run fmt`, `mise run check`,
`deno task build:ui`, and the manual check listed. No tests or scripts are added.

### Gate 1: packaged runtime behavior (do first, throwaway)

Spike outside the workspace in the scratch directory, not committed:

1. `deno desktop -A --include data -o Spike.app main.ts` where `main.ts`
   copies `data/plugin/mod.ts` (TypeScript, importing a bare specifier mapped
   in the spike's import map) to `$HOME/.fathom-spike/gen1/` and `import()`s it
   by `file://` URL; also calls `Deno.realPath`, `Deno.readDir`, and
   `Deno.copyFile` against `import.meta.dirname + "/data"`.
2. Record which calls succeed.

Outcomes:

- TypeScript import from disk works → backend plugins keep shipping as source;
  step 3 changes nothing in the loader.
- It fails → add `bundleBackend(pluginDir)` beside `bundleUi` in
  `packages/sdk/src/bundling` (esbuild, `platform: "neutral"`, externals
  `@fathom/*`, `node:*`, `npm:*`). `DenoLoader.load` imports the bundle instead
  of the copied tree. `build.ts` emits `dist/plugins/<id>/backend.js` for
  bundled plugins; `install.ts` bundles external plugins on add and on reload.
  This becomes step 3b and adds one day.
- `realPath`/`copyFile` fail on the embedded filesystem → `static.ts` uses
  normalized-path containment only; the loader copies with `readFile` and
  `writeFile`.

### Gate 2: rendering backend

Run the app under `webview` after step 4. Check the dialog open/close
transition, the popover menu, `overlay-glass`, and `min-h-dvh`. If any degrade,
set `"backend": "cef"` in `deno.json` and record the reason in Status. The CEF
choice also gives DevTools inside the window.

### Step 0: rename

- `git mv packages/host-deno packages/server`, `git mv packages/host-browser packages/renderer`; package names `@fathom/server`, `@fathom/renderer`; update the workspace list, the esbuild alias in the build script, and every import.
- `git mv packages/server/build.ts scripts/build-ui.ts`, `git mv packages/server/install.ts scripts/install-plugin.ts`; tasks point at them.
- Check: `mise run check` and `deno task build:ui` pass with no behavior change.

### Step 0b: one published package

Only `@fathom/sdk` goes to JSR. Kernel, server, renderer, and the app are
internals. See [architecture](../architecture.md#sdk-packaging) for why the UI
package folds into the SDK. Today `deno publish --dry-run` fails because five
control components side-effect import their stylesheet, which esbuild accepts
and Deno does not.

- `git mv packages/ui/src packages/sdk/src/ui/controls`; move the theme files to
  `packages/sdk/src/ui/theme/`. Delete `packages/ui`. `src/ui/mod.ts` re-exports
  the controls; SDK exports gain `./ui/styles.css`, `./ui/theme.css`,
  `./ui/typography.css`.
- `theme/styles.css` `@import`s theme, fonts, base, typography, and every
  control stylesheet. Remove the `import "./X.css"` lines from `Accordion`,
  `Button`, `Dialog`, `Menu`, and `ResizableSidebar`.
- `UI_RUNTIME_IMPORTS` drops `@fathom/ui`; the import map in `page/index.html`
  and the build entries drop `ui.js`. Plugins change `@fathom/ui` imports to
  `@fathom/sdk/ui`. `NamedContribution` imports `IconName` relatively.
- Move `packages/sdk/src/bundling/` to `scripts/bundling/`; the SDK drops its
  `./build` export and the esbuild, Babel, PostCSS, and Tailwind dependencies.
- Check: `deno publish --dry-run --allow-dirty` passes in `packages/sdk`; add it
  to the `check` mise task. `deno task build:ui` still renders every screen.

### Step 1: server reports its address

- `transport.ts`: `listen(handle, port?: number)` calls `Deno.serve` with
  `hostname: "127.0.0.1"` and `port ?? 0`, returns `{ origin, close }` where
  `origin` comes from `server.addr`.
- `bridge.ts`: accepts `launchToken` and optional `port`; derives `origin` from
  the listener result; returns `{ origin, close }`.
- `boot.ts`: accepts `launchToken` from the caller (so the shell can bind it
  before the listener exists) and optional `port`; returns `origin`.
- `environment.ts`: `AppEnvironment` gains `shell: "desktop" | "browser"`;
  `port` is replaced by `origin: string`. Update `plugins/storage` and
  `plugins/credentials` only if they read `port` (they do not today).
- Check: `deno run` mode still prints a working launch URL.

### Step 2: page obtains its token from the shell

- `packages/sdk/src/desktop.ts`: `export interface DesktopBindings { launchToken(): Promise<string> }`.
- `packages/renderer/launch-token.ts`: `readLaunchToken()`; order is
  `bindings.launchToken()` when `globalThis.bindings` exists, then hash, then
  sessionStorage; hash handling moves here from `apps/ui/main.tsx`, including
  the `hashchange` reload.
- Move `apps/ui/index.html` and `apps/ui/main.tsx` to `apps/desktop/page/`;
  delete `apps/ui`. `scripts/build-ui.ts` and the `check` task point at the new paths.
- `apps/desktop/page/main.tsx` shrinks to: find root, `await readLaunchToken()`,
  call `bootBrowser`, show the error string on failure.
- Check: browser mode unchanged; the missing-token message still appears when
  the page is opened without a hash.

### Step 3: `apps/desktop/window.ts`

- `desktopRuntime()` returns the `BrowserWindow` constructor typed from the
  Deno desktop API, or `undefined`. All `Deno.BrowserWindow` typing lives here.
- `openDesktop({ home, resources })` follows the native call graph above:
  adopt the initial window, hide it, bind `launchToken`, call `server` boot,
  set the menu, wire `menuclick`, `close`, and signals to one guarded `shutdown`,
  show the window.
- The menu is Fathom: Quit role; Edit: undo, redo, cut, copy, paste, selectAll
  roles; View: Reload, and Toggle DevTools when the backend is `cef`. Settings
  and other commands wait for a commands plugin, as the plugin roadmap states.
- If this file passes roughly 150 lines, split `menu.ts` beside it. Do not
  create a package for it.
- Step 3b (only if Gate 1 fails): `bundleBackend` and loader change in `server`.
- Check: `deno desktop --hmr apps/desktop/main.ts` opens a window that shows the
  workspace; editing a `server` module hot-swaps without a window restart.

### Step 4: composition root and tasks

- `apps/desktop/main.ts`: resolve `home` and `resources`, pick
  `bootDesktop` or the browser path, no `--browser` flag. `--no-open` remains for
  browser mode. The "build the UI first" check stays.
- `packages/server/open-browser.ts`: `openInBrowser(url)` (the `open` /
  `xdg-open` / `cmd start` logic moved out of `main.ts`).
- `deno.json`: add the `desktop` block (`app.name` Fathom, `app.identifier`
  `dev.fathom.app`, `backend` per Gate 2, `output.macos` `./dist/Fathom.app`),
  and tasks:

  ```json
  "dev": "deno task build:ui && deno desktop -A --hmr apps/desktop/main.ts",
  "dev:browser": "deno task build:ui && deno run -A --unstable-no-legacy-abort apps/desktop/main.ts",
  "desktop:build": "deno task build:ui && deno desktop -A --include dist/app --include dist/plugins --include plugins --exclude plugins/*/node_modules -o dist/Fathom.app apps/desktop/main.ts"
  ```

  `check` replaces `apps/ui/main.tsx` with `apps/desktop/page/main.tsx` and the old script paths with `scripts/*.ts`. `mise.toml`: `site` becomes
  `browser`; add `app` for the native dev loop. `.claude/launch.json` keeps
  pointing at browser mode, which is the only mode a browser pane can show.
- Check: both tasks start; `deno task desktop:build` produces `dist/Fathom.app`
  that launches from Finder with an empty `FATHOM_HOME`, restores saved provider
  connections with the real one, and quits cleanly from Cmd+Q and the close
  button.

### Step 5: documents

- `docs/plans/baseline.md`: Ownership table renames the Deno host row to Server and the Browser host row to Renderer, and adds "Application: window, menu, lifecycle, bindings"; the "Work after the baseline" paragraph no longer
  lists native transport as deferred.
- `docs/plugin-authoring.md`: run instructions use `deno task dev`, mention
  `dev:browser` for DevTools, and state that bindings are host-owned.
- `AGENTS.md`: commands section lists the three tasks; the structure paragraph uses server and renderer instead of hosts.

## Failure behavior

| Situation | Behavior |
| --- | --- |
| Second launch while another host holds `host.lock` | `boot` throws; `bootDesktop` shows the message with `Deno.dialogs` alert if available, otherwise logs, then exits non-zero. Focusing the existing window is deferred. |
| Host fails after the window exists | `bootDesktop` closes the window in `finally`; the runtime exits. |
| Page cannot reach `bindings` in native mode | `readLaunchToken` falls through to hash and storage; the missing-token text renders. This indicates a shell bug, not a user action. |
| Window closed during plugin drain | `close` is prevented until `host.close()` settles; a second click is ignored by the shutdown guard. |

## Deferred

Tray, notifications, dialogs beyond the lock error, deep links, auto-update,
signing identity and notarization, Windows and Linux verification, focusing an
existing instance, UI rebuild on file change during `--hmr`, and any binding
beyond `launchToken`. Each is a separate small plan when a plugin needs it.

## Status

Implemented. Gate 1 passed in full: the packaged binary imports TypeScript
plugin sources copied to the home directory, and `realPath`, `readDir`, and
`copyFile` work against the embedded files, so backend plugins ship as source.
`packages/server`, `packages/renderer`, and `apps/desktop/{main,window,browser}.ts`
exist as described; `packages/ui` folded into `@fathom/sdk/ui`; scripts moved
to `scripts/`; the `deno desktop --hmr` run was verified to serve the page and
hold an authenticated event stream from the WebKit view, and to shut down
cleanly on SIGTERM.

Not verified: the WebKit rendering of dialog and menu transitions (Gate 2),
because screen capture is not permitted for the terminal that ran it. Look at
the window once; if anything degrades, set `"backend": "cef"`. `deno task
desktop:build` produces `dist/Fathom.app` (229 MB, ad-hoc signed); launched
against an empty home it serves the page from its embedded files, starts every
backend plugin, connects the WebKit view, and exits cleanly on SIGTERM. `deno publish --dry-run` passes
every check except the missing repository license.
