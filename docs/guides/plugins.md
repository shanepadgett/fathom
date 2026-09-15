# Extend Fathom with plugins

A plugin can add backend services and tools, frontend views, commands, or entry
renderers. Start with the smallest contribution that solves the task. Use the
SDK types in `app/sdk/mod.ts`; the SDK is currently part of this checkout.

Start with [the runnable example](#run-the-workspace-information-example), then
read [installation scopes](#where-plugins-live), [lifecycle](#manifest-and-lifecycle)
and the [agent workflow](#agent-workflow). Keep backend work behind services and
RPCs; frontend plugins own presentation and use the host API.

Service reference: [media](#store-media-from-a-backend-plugin),
[images](#generate-images), [artifacts](#artifact-revisions),
[browser feedback](#browser-feedback), [feedback sources](#register-a-feedback-source),
[language servers](#register-a-language-server).

## Run the workspace-information example

The portable example in `app/examples/` adds a read-only `workspace_info` tool
and a **Show workspace information** command. Both use the same backend function
through separate tool and RPC registrations. It reads workspace metadata and
the session count; it does not read file contents or provider credentials.

From this checkout, install it for the current repository:

```sh
mkdir -p .fathom/plugins/workspace-info
cp app/examples/workspace-info.js .fathom/plugins/
cp app/examples/workspace-info/view.js .fathom/plugins/workspace-info/
```

For a machine-wide installation, copy the same files into the active Fathom home:

```sh
plugin_home="${FATHOM_HOME:-$HOME/.fathom}/plugins"
mkdir -p "$plugin_home/workspace-info"
cp app/examples/workspace-info.js "$plugin_home/"
cp app/examples/workspace-info/view.js "$plugin_home/workspace-info/"
```

Choose one location at a time; duplicate plugin IDs are rejected. Trust the
workspace when using repository scope, then reload plugins in Settings or restart
Fathom. Open the command palette and run **Show workspace information**. To
exercise the agent contribution, ask it to call `workspace_info` and summarize
the result. Use Luna for this functionality check.

The manifest owns dependencies, the shared metadata function, and registration
cleanup. Its child frontend module owns command behavior, request errors, and
protection against notifications after unload. Neither file imports this
checkout, so the pair can be moved without changing import paths. Extend this
layout with additional files only when the contribution needs them.

To unload the example, add `example:workspace-info` to `fathom.disables` in the
scope's configuration and reload. Remove that disable entry to load it again.

## Where plugins live

- Machine-wide: `~/.fathom/plugins/*.ts`, `*.js`, or `*.mjs`.
- Repository: `.fathom/plugins/*.ts`, `*.js`, or `*.mjs` under the workspace root.
- `FATHOM_HOME` replaces `~/.fathom` when running an isolated environment.

Repository plugins load only after the workspace is trusted. Global plugins
execute with the application's privileges. Keep frontend modules in a child
folder so discovery doesn't interpret them as additional plugin manifests.

A workspace or Fathom home `deno.json` / `deno.jsonc` can include:

```json
{
  "fathom": {
    "plugins": ["extensions/*/plugin.ts"],
    "disables": ["example:unused"]
  }
}
```

Paths are relative to that configuration file. IDs must be unique. When plugin
files change, use the reload notice or Settings to reload the environment after
active runs finish. Frontend and backend local helper modules rebuild on reload.
Backend entries and their statically discoverable local imports compile into a
fresh module graph. This includes literal dynamic imports such as
`import("./helper.ts")`. Package imports (`npm:`, `jsr:`, `node:` and configured
bare names) stay external and share the host runtime.

Use explicit relative imports for reloadable helpers. Computed dynamic imports,
`import.meta.resolve()`, and runtime-generated module URLs are not guaranteed to
join the compiled graph; restart after changing modules loaded that way.
`import.meta.url`, `import.meta.dirname`, and `import.meta.filename` retain the
original source location, so source-relative file reads still work. Generated
backend and frontend bundles live under the Fathom home's
`cache/plugins/<project-id>/<generation>/` directory. Each prepared environment
owns its generation: failed preparation removes it; rollback retains the
previous generation; successful replacement removes the old one. Normal desktop
Quit and window close wait for environment cleanup. On project startup, Fathom
removes marked generations whose owning process has exited. Live owners and
uncertain process status are preserved. Older, unmarked cache layouts are left
untouched; directory age alone never authorizes removal.

Fathom watches the default plugin folders, the directory prefixes of configured
plugin patterns, and each scope's `deno.json` / `deno.jsonc`. Prefer a narrow
pattern such as `extensions/*/plugin.ts`; a broad `**/*.ts` pattern watches the
whole scope. Changes to helpers outside those directories require a manual
reload or restart. Disabling a plugin excludes both backend activation and
frontend contributions. Keep module-level code free of side effects: discovery
still imports a manifest to read its ID before applying the disable list.

Reload prepares backend bundles, imports, dependency ordering, and frontend compilation before
disposing the current environment. Preparation errors leave that environment
running. If backend activation fails, Fathom attempts to remount the previous
plugin set and reports whether recovery succeeded. Fix the source and reload
again. Recovery cannot undo external side effects or revive disposed subprocesses;
keep activation small and register cleanup as soon as a resource is created.

## Manifest and lifecycle

```ts
export default {
  id: "example:clock",
  apiVersion: 1,
  frontend: "./clock/view.js",
  backend: {
    requires: ["tools"],
    activate(ctx) {
      const unregister = ctx.get("tools").register({
        name: "workspace_clock",
        description: "Read the current time.",
        readOnly: true,
        parameters: { type: "object", properties: {} },
        execute: async () => new Date().toISOString(),
      });
      ctx.effect(() => unregister);
    },
  },
};
```

The host orders backend activation by `requires` and `provides`. Each backend
runs in a Cordis scope. Register cleanup with `ctx.effect` so reload releases
listeners, tools, and other resources. A service provider calls
`ctx.provide(name, service)` and declares the same name in `provides`. The host
rejects duplicate service providers and unsatisfied dependencies.

Frontend files export an object with `activate(host)`. Return cleanup for any
resources you create. Host registration methods also track their registrations
for unload. Use `host.request` for backend RPC and `host.onEvent` for application
events. `host.session()` reads the selected session.

## Render a custom conversation entry

```js
export default {
  activate(host) {
    return host.registerEntryRenderer({
      id: "example:note",
      matches: entry => entry.custom?.type === "example:note",
      mount(element, host, entry) {
        const paragraph = document.createElement("p");
        paragraph.textContent = String(entry().custom?.data ?? "");
        element.append(paragraph);
        return () => element.replaceChildren();
      },
    });
  },
};
```

The first matching registered renderer wins. `entry` is an accessor to the entry
being rendered. Use text nodes for untrusted text. A synchronous rendering error
falls back to Fathom's default content. Keep predicates pure and inexpensive.

Other frontend contributions are `registerView`, `registerCommand`,
`registerSurfaceOverride`, and `host.ui.registerComponent`. Their exact argument
and cleanup types are in `app/sdk/frontend.ts`. Surface overrides replace the
shell, transcript, or editor; use a view slot when a smaller addition is enough.

### Command shortcuts

Pass `shortcut: "Mod+Shift+U"` to `registerCommand` to bind a command and show
its shortcut in the palette. `Mod` (also `CmdOrCtrl`) means Command on macOS
and Control elsewhere. Explicit `Ctrl`, `Meta` (also `Cmd`), `Alt` and `Shift`
are supported. End the binding with one letter, digit, or one of `, . / ; = -`.
Bindings require Control or Command; modifier matching is exact. Letter/digit
bindings use physical key codes so Alt-generated characters do not change them.

Registration rejects duplicate bindings and unshifted primary shortcuts used
for common editing and Fathom commands. Prefer a modified combination such as
`Mod+Shift+U`. Shortcuts pause while a dialog is open, during text composition,
or when a focused control has already handled the event. Held-key repeats and
overlapping shortcut execution of the same command are ignored. Errors appear
as notifications. Unregistering or unloading the command removes its binding.

### Reuse Fathom's UI components

`host.ui.getComponent("fathom.button")` and
`host.ui.getComponent("fathom.text-field")` mount the same Button and Field used
by Fathom. They need no framework import or copied CSS. Types live in
`app/sdk/ui-components.ts` and are exported by `app/sdk/mod.ts`.

`fathom.icon-button` shares the application's icon control. Supply a typed
`IconName`, an accessible `label`, and `onClick`. Optional `pressed`, `expanded`,
`disabled`, and `toolbar` props control state and icon size. Import the icon
type from the SDK; do not import app UI files or copy the icon-name list.

`fathom.connection-row` is the same row used for provider and MCP settings.
Supply `name`, `status`, optional avatar text, and an `actions` HTML container.
Mount shared buttons into that container. Your plugin owns its action components:
dispose them before disposing the row. Updating row props preserves the supplied
action container and its event handlers.

The portable `app/examples/connection-controls.js` and
`app/examples/connection-controls/view.js` demonstrate both components in the
inspector. Copy the manifest and its child folder into either plugin scope using
the same layout as the workspace-information example. Toggle the preview button
to exercise prop updates. It changes only example UI state; it does not connect
to a provider or store credentials. Unloading removes the view and both mounts.

`fathom.message-card` accepts `author`, Markdown `text`, `createdAt` (Unix
milliseconds), and optional `agent`, `working` and `model` props. It shares the
transcript's message container, author header and Markdown renderer. Source HTML
and remote Markdown images stay disabled. It renders supplied content only;
tool execution, media attachments and session mutations remain separate services.

`fathom.diff` accepts `{ patch: string }` and mounts Fathom's existing unified
diff preview, including changed-line counts, added/removed styling and an empty
state. Update `patch` to replace the preview. This component does not read files,
apply patches or stage Git changes. The portable `app/examples/diff-view.js` and
`app/examples/diff-view/view.js` demonstrate toggling a supplied patch without
duplicating diff parsing or rendering.

`fathom.terminal` mounts the existing terminal panel. Supply `sessionId`, `theme`,
`onClose` and `onError`. It uses the current host project's terminal RPCs and
events; `host.projectId` exposes that project ID for other scoped integrations.
The mount attaches to existing terminals. Its default `autoStart: false` leaves
shell creation to the plus button; opt into `autoStart: true` when automatic
creation is intended. Updating `sessionId` switches the panel's session.

Disposal releases xterm and frontend listeners, while the backend owns shell
lifetimes. Hiding a view preserves its terminal so reopening can attach to it.
Use Stop to terminate a shell; environment reload and application shutdown also
dispose backend terminals. Do not treat hiding the view as process cancellation.
The `terminal-view` example opens a panel for the session selected when its
command runs, tracks theme changes, and removes its view and listeners on unload.

`fathom.split-pane` arranges `first` and `second` HTML containers side by side.
Give its mount container a height, and supply a descriptive `label` for the
resize handle. Optional `width`, `minFirst`, and `minSecond` are CSS pixels;
the default split is half-width with 120-pixel minimums. Bounds shrink to fit
when both minimums cannot fit. `onResize(width)` reports pointer/keyboard changes.
The approved EdgeResizer supplies drag, Left/Right, Home/End, and Enter reset.
The split clamps its first pane when its container changes size.
Optional `firstVisible` and `secondVisible` props hide either pane without
disposing its contents. The remaining pane fills the available width, and the
resize handle returns when both panes are visible. The preferred width survives
temporary window constraints; the layout owner decides how to persist it.

The caller owns components mounted inside both containers. Dispose those
components, then dispose the split. The portable `split-view` example composes
the shared message card and diff this way. Its control cycles through first-only,
second-only, and both panes; resize before cycling to check width retention.
This adapter supports horizontal
splits; it does not persist layout automatically or implement vertical splits.

```js
const mountButton = host.ui.getComponent("fathom.button");
const props = {
  label: "Refresh",
  variant: "secondary",
  onClick: () => host.toast("Refresh requested"),
};
const button = mountButton(container, host, props);
button.update({ ...props, label: "Refresh again" });
// Dispose this instance when its owning view is removed.
return () => button.dispose();
```

Updates replace the complete props object. Each mount owns its own container;
dispose it before replacing that container's contents. Built-in disposal is
idempotent, and updates after disposal do nothing. View cleanup owns mounted
instances; unloading a registration does not replace that responsibility.

Custom components use `host.ui.registerComponent("my-plugin:component", factory)`.
A factory receives `(container, host, props)` and returns `{ update, dispose }`.
Consumers of custom names supply their shared props type to `getComponent<Props>`
and handle an undefined result when the providing plugin is unavailable. Keep
component providers and consumers in the same plugin when activation order is
not otherwise controlled. Duplicate and built-in names are rejected. Built-in
components remain available across environment reloads.

The portable `app/examples/ui-kit.js` and `app/examples/ui-kit/view.js` example
adds an inspector field and button. Install the manifest and child folder in
either plugin scope using the same layout as workspace-info. Typing updates the
button label and enabled state; clicking it updates a shared message card with a
greeting. No model request is needed.

This replaces the unpublished registry's earlier `ViewMount` factory shape;
custom registry factories must now return an instance with `update` and `dispose`.
View-slot and surface-override APIs are unchanged.

## Register a custom model gateway

`app/examples/custom-gateway.js` registers an OpenAI Chat Completions-compatible
gateway through Pi. It requires the `model` service and owns its registration
through `ctx.effect`, so unloading the plugin removes the provider. It rejects
an existing provider ID instead of replacing another plugin's registration.

Configure `FATHOM_GATEWAY_URL` with the API base URL, including `/v1` when required,
and `FATHOM_GATEWAY_MODEL` with the model ID served by that endpoint. Set these in
the desktop process environment before launching. Adjust the example's context
window, output limit, input capabilities and token prices to match your model;
the sample prices are zero and must not be treated as verified usage costs.

Copy the manifest to either location:

```sh
# Machine scope, using your active Fathom home:
mkdir -p "${FATHOM_HOME:-$HOME/.fathom}/plugins"
cp app/examples/custom-gateway.js "${FATHOM_HOME:-$HOME/.fathom}/plugins/"

# Or repository scope, after trusting that workspace:
mkdir -p .fathom/plugins
cp app/examples/custom-gateway.js .fathom/plugins/
```

Install one copy, then reload the environment. Settings → Providers shows
**Example gateway**. Connect through its API-key option, or supply
`FATHOM_GATEWAY_API_KEY` in the backend process environment. Pi owns credential
storage and resolution; do not put keys in the manifest or URL. A gateway must
actually be running before you send a model request. Registration alone does
not verify endpoint compatibility or model availability.

For development from this checkout, launch with the two non-secret settings:

```sh
script/build_and_run.sh --debug \
  --env FATHOM_GATEWAY_URL=http://127.0.0.1:11434/v1 \
  --env FATHOM_GATEWAY_MODEL=your-installed-model
```

The launch script forwards explicit `--env NAME=value` arguments to the desktop
process. Use this for non-secret plugin configuration; enter credentials through
provider settings instead of putting them in command arguments.

The example pins Pi to the app's version. When upgrading Pi, update both pins
and consult its `createProvider`, `envApiKeyAuth` and API adapter contracts.
Use `fetchModels` for a dynamic catalog and the appropriate Pi adapter for a
different protocol. Remove the manifest and reload to unregister the provider;
saved credentials are separate and are not deleted by unloading a plugin.

## Agent workflow

1. Read the workspace instructions and the relevant SDK service interfaces.
2. Add a uniquely named manifest and keep its frontend dependencies separate.
3. Reuse the approved `design/tokens.css` and components for product UI.
4. Launch the native app with `script/build_and_run.sh --debug` from the repo.
5. Exercise the contribution in the desktop window, including reload and cleanup.
6. Record the observed behavior in `docs/technical/implementation.md`.

Do not put provider credentials in plugin manifests or frontend code. Provider
connections belong to the backend authentication system. No automated tests are
required during the current implementation phase; use the running desktop app.

### Choose the extension boundary

| Need | Contribution | Owner |
| --- | --- | --- |
| Give the agent a new capability | `tools.register` | Backend |
| Expose an action to a frontend | `rpc.register` | Backend |
| Add a command to the palette | `registerCommand` | Frontend |
| Add a small panel | `registerView` | Frontend |
| Display a custom transcript entry | `registerEntryRenderer` | Frontend |
| Replace a complete product surface | `registerSurfaceOverride` | Frontend |

Keep file access, credentials and subprocesses in the backend. A frontend
contribution calls a named RPC rather than importing a backend implementation.
Use `workspace.resolve` for workspace paths and the tool's abort signal for
long-running work. A plugin that registers RPC handlers declares `rpc` in
`requires` and unregisters its handlers through `ctx.effect`.

Treat returned disposal functions as part of every contribution. Dispose your
timers, event listeners and processes as well as host registrations. Reloading
should leave one instance of each contribution, not accumulate copies. Keep
the manifest thin when the contribution grows: put service logic, UI mounting
and shared data types in separate files with a single owner for each state.

### Move a plugin between machine and repository scope

Keep the same relative layout in either location:

```text
plugins/
  clock.ts
  clock/
    view.js
```

For machine scope, put this layout under the active Fathom home. For repository
scope, put it under the repository's `.fathom/` directory. Copy both the manifest
and its child directory together; `frontend: "./clock/view.js"` resolves from
the manifest. Remove or disable the other copy before loading the same plugin
ID from another scope. Fathom rejects duplicate IDs rather than choosing one
implicitly. Repository scope also requires workspace trust.

### Codex completion checks

When extending this checkout through Codex, its `.codex/hooks.json` defines
Markdown, design and app completion checks. These are Codex lifecycle hooks.
Codex requires review and trust for each hook definition; review new handlers
in `/hooks`. Trusting the repository does not establish trust for every handler.
See the [Codex hook documentation](https://learn.chatgpt.com/docs/hooks).

The app hook records its result in `.codex/verification/app.json`. Check its
timestamp and status before claiming automated checks passed. A missing file
means there is no recorded app-hook result. Native builds and direct desktop
use remain separate evidence, and neither proves that the completion hook ran.

### Editor completions

The built-in editor plugin exposes `lsp.completion` through `host.request`:

```ts
const result = await host.request("lsp.completion", {
  projectId: host.projectId,
  path: "src/main.ts",
  text: currentUnsavedText,
  position: { line: 3, character: 12 },
});
```

Positions use zero-based lines and UTF-16 character offsets. Supply the current
document text; requesting suggestions does not save the file or persist a draft.
Editor text is limited to 4,000,000 UTF-8 bytes across reads, drafts, saves,
recovery and completion requests. The shared transport allows 25 MB per request
to accommodate JSON escaping; this does not raise individual service limits.
The SDK exports `CompletionResult`, `CompletionItem`, position and edit types.
Results contain `isIncomplete` and `items`; edits can have a single range or
separate insert/replace ranges. Monaco integration belongs to the frontend and
does not leak into the server contract.

The built-in Deno server supports JavaScript and TypeScript. Unsupported files,
an unavailable server, and a three-second completion timeout return no items.
Invalid paths, text or positions are rejected. Lazy completion-item resolution
remains unfinished.

### Register a language server

Backend plugins declare `requires: ["lsp"]` and register an installed stdio
server through the shared `LspService`. Bind registration to the plugin scope:

```ts
ctx.effect(() => ctx.get("lsp").register({
  id: "rust-analyzer",
  name: "Rust Analyzer",
  command: "rust-analyzer",
  languages: { ".rs": "rust" },
  initializationOptions: { checkOnSave: false },
}));
```

Use the [portable language-server example](../../app/examples/language-server/README.md)
for global and repository installation instructions and the complete contract.
The executable must already be installed and available to the native app;
an absolute command path avoids differences between shell and app environments.
Missing or failed servers report Unavailable without preventing editing.

Some servers request a named `workspace/configuration` section in addition to
their initialization options. Include that section as a nested property when
its name differs from the registration id. For example, a Deno registration
named `custom-deno` needs `initializationOptions: { enable: true, deno: {
enable: true } }` because Deno requests the `deno` section. Consult the server's
configuration documentation rather than assuming that Connected means all
language features are enabled.

Higher priority selects a matching healthy server; equal priorities sort by
stable id. Use a distinct id with a higher priority to override Deno while
retaining it as a fallback. Explicit `{ replace: true }` permanently retires
an existing registration with the same id. Scoped disposal removes the
registration and awaits process cleanup.

Recover an existing registration with `await ctx.get("lsp").restart("rust-analyzer")`,
or from a frontend with `await host.request("lsp.restart", { id: "rust-analyzer" })`.
The RPC accepts a registration id, not a command or configuration; unknown or
malformed ids fail. The inspector offers the same Restart action with pending
and inline failure states. Recovery disposes the old process, clears its stale
markers, starts the retained configuration and rebinds open documents through
normal synchronization using their latest in-memory text, without saving files.
Priority and the original plugin's scoped ownership are unchanged. Concurrent
restarts share one operation. Unload, replacement and project disposal retire
recovery rather than allowing it to recreate a removed registration.

Restart resolves with `RegisteredLanguageServerStatus` after startup and queued
document rebinding; it rejects on failure or retirement. A failed registration
remains available for another restart, and healthy matching fallbacks can still
serve documents. Success is not a diagnostics/compilation barrier: diagnostics
arrive asynchronously. Restart does not install a missing executable or repair
configuration; change those through the owning plugin and reload it.

Editor buffers, completions, built-in file tools and diagnostic consumers use
this gateway. `lsp.servers` lists all registrations; `lsp.status` accepts a path
to identify its selected server. Diagnostic results are the latest asynchronous
reports, not a compilation barrier. Backend registration does not register a
Monaco syntax grammar automatically. Register one separately with
`await host.registerLanguage({ id, extensions, monarch, configuration, priority })`
in the frontend activation function. The host scopes it to the project, updates
open editor and diff models, and cleans up on unload. The language-server example
includes a portable Rust grammar that works without its backend binary.

The gateway defaults omitted diagnostic severity to error, matching the editor.
Explicit warning, information and hint severities remain unchanged. This keeps
editor markers, status counts and automatic agent review consistent; the
[LSP diagnostic contract](https://github.com/Microsoft/vscode-languageserver-node/blob/main/types/src/main.ts)
leaves omitted severity to the client.

### Automatic diagnostic review

`fathom:diagnostic-review` is a separate built-in backend plugin requiring the
shared LSP service. It tracks successful built-in `write` and `edit` operations
within a run and compares the workspace with its admission snapshot, covering
shell-made changes too. Before a response without tool calls concludes, it reads their
latest diagnostics and feeds errors back through the existing `step:after`
continuation hook. The runtime supplies that hook with the run's abort signal.
Continuations can supply `source: { pluginId, label }`; Fathom persists that
attribution and displays it in the existing message header. Automatic diagnostic
feedback is labeled **Diagnostic review**. It remains user-role model context,
but is not presented as a message authored by the user or offered for editing.

Review allows up to three repair prompts, then records unresolved errors in the
conversation. Reads have a three-second per-file bound and a ten-second overall
review deadline. A configured but unavailable language server is reported as
not reviewed, rather than a successful empty result. The
Stop action interrupts the wait. This uses asynchronous server reports
after a short settling period, not a compiler completion guarantee. Snapshot
discovery uses the isolated snapshot index and excludes deleted and ignored
files. Concurrent user edits made after admission can appear in the same
comparison; this is a time baseline, not proof of who changed a file. Disable or
replace `fathom:diagnostic-review` through the normal plugin configuration to
supply a different review policy.

Deleted files are removed from the review set and closed through `lsp.close`,
clearing their cached diagnostics. A failed refresh is reported as incomplete;
review does not reuse that file's old diagnostic results. Read-only runs skip
workspace comparison, while failed mutating commands still trigger it because
they can leave partial file changes.

### File activity and editor navigation

Plugins can publish a `file` event through the events service after a successful
file operation. Include the active `sessionId` and SDK `FileActivity` data:
`{ path, changed, range: { startLine, endLine } }`. Ranges are one-based and
inclusive; omit the range if the operation cannot identify affected lines.
Set `changed: false` for reads. The built-in read, write and hashline edit tools
already publish these events.

When Following agent is enabled, the visible editor opens activity from the
active session and briefly highlights its range. Turning it off preserves the
user's chosen file. Existing unsaved drafts remain intact. The server still
validates workspace paths and stale writes; a navigation event grants no file
access. Read-result Open file actions also use the requested offset and limit.

### File comparisons

`host.request("git.diff", { projectId: host.projectId, path })` returns the SDK's
`FileDiff`: `path`, `original`, `modified` and unified `patch`. The original is
the HEAD version (the previous path for a rename); the modified version comes
from disk. Unsaved editor drafts are not included. New files have an empty
original, and deleted files have an empty modified version.

The app's shared `FileDiff` component renders these versions through Monaco,
with inline/side-by-side switching and previous/next-change navigation. Review
is read-only; the editor review's Open in editor action takes you to the normal
editable document. Reviews show saved snapshots and have a Refresh action that
preserves inline/side-by-side selection. Fathom file-write, Git and connection
events mark a review as potentially stale; unrelated external filesystem writes
can require manual refresh. The `fathom.diff` plugin component remains a lightweight
unified-patch preview, suitable for tool cards and inspector contributions.

### Native development runtime

Use the [desktop development guide](desktop-development.md) for persistent macOS
signing. Rebuilding with ad-hoc signatures can invalidate App Management grants;
the shared native build command retains the selected certificate identity.

The desktop launch script resolves Deno through mise and passes its absolute
path as `FATHOM_DENO`. The language server and built-in Deno script tool share
that runtime. Set `FATHOM_DENO` before launching to use a different executable.
Other script interpreters and plugin subprocesses must be available on the
desktop process's PATH or configured with an absolute path. A shell's interactive
startup configuration does not automatically apply to desktop apps.

Use an isolated `FATHOM_HOME` for development data when exercising plugins:

```sh
FATHOM_HOME=/tmp/fathom-development script/build_and_run.sh --debug
```

This changes the global plugin directory to `/tmp/fathom-development/plugins`.
Repository plugins continue to load from the active workspace. Quit the desktop
app when verification is finished so its plugin resources are disposed.

## Store media from a backend plugin

Declare `media` in `backend.requires` and call `ctx.get("media").save(sessionId,
{ name, mime, data })`, where `data` is a `Uint8Array`. The service accepts PNG,
JPEG, WebP, GIF, MP3, WAV, Ogg, M4A, MP4 and WebM, with a 64 MiB limit per asset.
Callers supply the correct MIME type for their bytes. It writes a private binary
file under `projects/<project-id>/media/` in the active Fathom home and appends a
timeline entry containing only metadata. Do not put base64 binaries in session
entries. `list(sessionId)` and `read(sessionId, id)` only expose references on
that session's current branch. Types are exported from `app/sdk/mod.ts`.

The built-in deferred `import_media` tool uses this service to copy an existing
workspace media file into the cache. It leaves the source file intact. Media
entries render image thumbnails with full-size previews, native audio/video
controls, filenames, sizes, Download, Copy image and Save to workspace actions. Custom entry renderers can
replace this presentation through the normal frontend plugin API.

Use `media.materialize(sessionId, assetId, path)` from a backend plugin to export
an asset to a new workspace path. The frontend RPC is `media.materialize` with
`sessionId`, `id` and `path`; agents use the deferred `export_media` tool. All
three use the same service and refuse existing destinations or paths outside
the workspace. Media and artifact export share `atomicCreate`: write and sync a
temporary file beside the destination, link it into place without replacement,
then remove the temporary name. Filesystems without hard-link support return an
error; no overwrite fallback is used.

Media and artifact export first call `assertNewFile` after resolving the authorized
workspace path. It checks with `lstat`, rejects existing files, directories and
symlinks, and creates nothing. This is an early error check, not a reservation;
`atomicCreate` still protects the final write if another process creates the path.

Use the workspace service's `resolve(path, write)` for file access. Readable
roots include the repository, Fathom's skills/references/artifacts/types, and
the project's scratch directory. Writes resolve inside the repository. Root
aliases such as macOS `/tmp` are compared using their canonical paths; a
symlink that resolves outside the authorized roots is still rejected.

The authenticated `/media/<project-id>/<session-id>/<asset-id>` route resolves
the current branch through the media service. Add `?download=1` for an attachment
response. It supports GET, HEAD and single byte ranges; conditional or multiple
ranges fall back to a full response. Assets are capped at 64 MiB and currently
read into memory per request. Additional provider adapters and storage-pruning
controls remain unfinished.

## Cache media for a plugin-owned draft

`media.cache(sessionId, { name, mime, data })` stores binary content and returns a
`MediaAsset` without adding a timeline entry or composer attachment. Persist that
reference with your own draft. When the user submits it, pass
`{ type: "media", data: asset }` in the runtime submission's attachments. The
accepted branch then makes the asset available through normal media reads,
previews and model context. Cached images have the same 8 MiB limit as chat
attachments; other supported media retain the 64 MiB limit.

The caller owns draft references and eventual publication. Abandoned cached files
remain until media cleanup is implemented. Cache does not expose an unauthenticated
file URL or make an unpublished asset branch-visible.

## Stage composer attachments

The composer uploads image, audio and video files into a per-session draft.
Paste also stages files from the clipboard; normal text paste stays in the text
editor. Copy image writes a PNG to the system clipboard. JPEG, WebP and GIF
sources are converted to a still PNG snapshot; Download preserves the original
format and animation. Conversion refuses images above 32 million pixels.
Clipboard permission or decoding failures appear beside the Copy image action.
The implementation follows the [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write)
and starts the write during the button click, with image preparation passed as
a promise to `ClipboardItem`.
Selection does not append conversation entries or invoke a model. Drafts survive
restart; removing an attachment removes its draft reference. Send, Steer and
Queue commit selected metadata with the user message. The draft accepts four
media files, with an 8 MiB limit for each image and 64 MiB for audio/video. Text
files still append UTF-8 context to the text draft, capped at 1 MiB each.

Backend plugins use `media.stage(sessionId, { name, mime, data })`,
`media.draft(sessionId)`, `media.readDraft(sessionId, id)` and
`media.releaseDraft(sessionId, ids)`. `stage` shares the private binary cache
with `save` but does not publish a conversation entry. The upload endpoint is
`POST /media/<project-id>/<session-id>/upload` with a raw binary body,
`Content-Type`, and a URI-encoded filename in `X-Fathom-Filename`.
Authenticated draft previews use the asset route with `?draft=1`.

`session.submit` accepts a `media` array of staged IDs. The server resolves these
into `Entry.attachments` and clears accepted draft references. Runtime queues and
edit-and-resend retain attachment metadata. A failed admission leaves the draft
available. A crash after acceptance but before draft cleanup may leave duplicate
draft references; inspect the conversation before retrying an uncertain send.
Removed or abandoned binary assets remain cached pending storage pruning.

Queued follow-ups remain saved while `run:admit` executes. Admission commits
queue removal and the new user entry in one transaction; a rejected admission
retains the item and its attachments. Steering uses the same atomic append and
queue-removal boundary. Editing or removing an item while admission is pending
invalidates that attempt rather than submitting stale text. In an idle session,
**Send now** retries a retained item through admission. Backend plugins use
`runtime.sendQueued(sessionId, id)`; the frontend RPC is `queue.send`.

`EntryAttachment` has a plugin-defined `type` and `data`. Register a context
projector for that type to contribute model context, using the same mechanism as
custom timeline entries. Keep binary data outside the entry. Custom frontend
entry renderers receive attachments and own their presentation when replacing
the built-in message body.

## Let chat models see media

The `fathom:media-context` plugin supplies vision-capable chat models with up to
four recent image references, capped at 8 MiB each. It resolves branch-visible
assets just before the model request through `step:model`; persistent context
and compaction retain text references, never image bytes. Text-only models keep
those text references. Missing or oversized images are described as unavailable
in the request instead of being silently represented as visible content. This
request-time plugin is separate from media storage and can be disabled without
removing cached assets or transcript previews.

## Storage inspection

Settings → Storage shows file sizes across all projects in the active Fathom
profile, grouped into snapshots, artifacts, media, SQLite databases and other
files. Use Refresh storage for a new scan. Folder actions open the profile's
projects, artifacts or root directory in the OS file manager.

The `fathom:resources` plugin provides `resources`. Backend plugins can declare
that dependency and call `ctx.get("resources").scan()` or `.open(kind)`; UI
clients use `resources.scan` and `resources.open`. SDK report types describe
bytes, file counts, skipped paths and whether a result is partial. The scan
reads filesystem metadata, skips symbolic links, shares concurrent requests
within its plugin instance, and stops after 15 seconds or 100,000 paths. These
are file sizes, not allocated filesystem blocks. Unused media cleanup remains open.

Snapshot cleanup below the meters applies to the current project. Review shows
snapshots unused for 30 days; confirm removal only when older file restoration
is no longer needed. Conversation history is preserved. Shared Git objects may
remain reachable, so removing references does not guarantee a particular space
saving. Legacy snapshots receive a fresh 30-day period on first inspection;
invalid age records are retained. If cleanup fails, retry to collect remaining
unused objects, including when no references are eligible.

The `snapshots` service exposes `planPrune()` and `prune(plan.trees)`, also
available as `snapshots.planPrune` and `snapshots.prune` RPCs. Use the exported
`SnapshotService` and `SnapshotPrunePlan` SDK types. Pruning rechecks selected
references under the same cross-process lock as capture and restore, protects
recent reuse, deletes references with expected-object checks and runs foreground
Git collection. Do not run external Git writers against Fathom's shadow store.
Reference deletion is sequential; an interrupted operation can remove a subset,
which is why clients must show retryable partial-failure feedback.

## Message links

Use **Copy message link** below a message, then open the command palette with
Cmd/Ctrl+K and choose **Open message link** to revisit it. These machine-local
references survive desktop restarts and contain project, session and entry IDs.
They do not publish conversations or grant access to another machine. Opening
them directly from other applications is not wired to an OS protocol handler yet.

Plugins can import `messageLink`, `parseMessageLink` and `MessageTarget` from
`sdk/mod.ts`. The same formatter and parser serve the transcript and opening
dialog. A link identifies the conversation branch from which it was copied;
opening it reports an error if that branch no longer contains the entry.

## Generate images

Choose an image model in Settings → Providers → Image generation. Pi 0.85.1
ships an OpenRouter image adapter. Fathom also registers native OpenAI, xAI and Google
adapters through `fathom:native-images`; all share the existing credential store.
Image models use Pi's separate `ImagesModels` API, so selecting one does not
change the chat model. Disabled is the default and hides `generate_image` from
tool discovery and execution. A configured model enables the deferred tool.

`generate_image` accepts `prompt`, up to four optional reference asset IDs in
`images`, and an optional `destination` for a single output. Results go through
the media service and appear in the transcript. The destination uses the same
no-overwrite export path. Explicit destinations are checked for blank input,
workspace boundaries and existing entries before the provider request. Multiple
outputs stay in the cache and must be
exported individually. Provider failures and cancellation become tool failures;
reported usage is attributed to `fathom:images`. Catalog cost estimates may omit
image charges.

Backend plugins can declare `images` and call `ctx.get("images").generate(...)`
or contribute image providers through its mutable `models` collection using
Pi's `createImagesProvider`. Remove only the provider instance your plugin
installed during disposal. `ToolDefinition.available(sessionId)` is a
synchronous capability gate applied to discovery and runtime execution; use it
for tools whose schemas should only appear when their capability is configured.

`fathom:native-images` declares the `images` service and registers Pi
`ImagesProvider` instances. Each adapter reuses its chat provider's `auth`, so
xAI OAuth refresh and Google API-key resolution follow Pi's normal credential
path. Disposal removes only provider instances this plugin installed.

The xAI adapter follows the documented [generation](https://docs.x.ai/developers/model-capabilities/images/generation)
and [editing](https://docs.x.ai/developers/model-capabilities/images/editing)
JSON endpoints. It requests one base64 JPEG and accepts up to four reference
assets, including the documented multi-image form. Google uses
[generateContent](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)
with text/image parts and returns final image/text parts, excluding thought
parts. Both feed the existing cache, preview and export services.

OpenAI offers two image selections using an OpenAI Platform API key:

- `gpt-image-2`: direct Images API generation, with multipart reference edits.
- `gpt-image-2-responses`: a Fathom selection ID for GPT Image 2 through Responses.
  The request uses `gpt-5.6-luna` with the `image_generation` tool pinned to
  `gpt-image-2`. Completed `image_generation_call` results become cached images.

Both request PNG output and accept PNG, JPEG or WebP references. Responses uses
`store: false` and requires the image tool; it does not persist provider-side
conversation IDs for follow-up editing. Reference asset IDs carry each edit's
inputs. These selections use the existing `openai` credential, independently
of the `openai-codex` ChatGPT subscription login. See OpenAI's
[image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
and [Luna tool support](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

`imageRequest` provides bounded JSON response reading, cancellation, a five-minute
default timeout and Pi payload/response callbacks. It sends JSON or FormData;
fetch owns the multipart boundary. Redirects are rejected. It
does not automatically retry potentially billed generation requests. These
native adapters currently omit usage when they cannot provide a complete Pi
usage record; their image charges are absent from catalog-based session totals.
Native Google and OpenAI requests require their respective API credentials and
remain unverified on the current development machine.

## Artifact revisions

Backend plugins declare `artifacts` in `requires` and use `ctx.get("artifacts")`.
The `ArtifactService` contract is exported from `sdk/mod.ts` alongside
`ArtifactInput`, `Artifact` and `ArtifactFeedback`.

```ts
const artifacts = ctx.get("artifacts");
const plan = await artifacts.create(sessionId, {
  name: "plan.md",
  title: "Implementation plan",
  content: "# Plan\n\nDescribe the proposed work here.",
});
const versions = artifacts.list(sessionId);
const document = await artifacts.read(sessionId, plan.id);
```

`materialize(sessionId, id, path)` exports a new workspace file and refuses an
existing destination. `approve(sessionId, id)` submits the approved work to that
conversation; use it only for an explicit approval action. These are the same
operations used by the built-in tools and viewer RPCs.

### Replace the artifact provider

`fathom:artifacts` provides the `artifacts` service. The separate
`fathom:artifact-integration` plugin owns the built-in tools, viewer RPCs,
feedback and model-context projection. To replace persistence, install your
provider in repository or machine scope, declare `provides: ["artifacts"]`, and
call `ctx.provide("artifacts", implementation)` with an `ArtifactService`.
Disable `fathom:artifacts` in that scope's `fathom.disables`; keep
`fathom:artifact-integration` enabled. Cordis resolves the integrations against
your provider and rejects duplicate or missing providers before activation.

Preserve branch visibility, immutable IDs/revisions, metadata timeline entries,
non-overwrite workspace exports, and explicit approval semantics. Transcript
cards use standard artifact and artifact-approval entries; replacements must
maintain those contracts. Model context references IDs and `artifact_read`, so
it does not assume a provider's filesystem layout.

To disable the whole artifact feature instead, disable both built-in plugins
and any consumer such as `example:artifact-catalog` that requires the service.

### Read-only consumer example

The portable `app/examples/artifact-catalog.js` plugin demonstrates a read-only
consumer. Copy it into `.fathom/plugins/` for repository scope, or into
`${FATHOM_HOME:-$HOME/.fathom}/plugins/` for machine scope, then reload plugins.
Install it in one scope at a time. Ask Luna to call `artifact_catalog`; it lists
only artifacts visible on the current branch. The example declares its service
dependency and disposes its tool registration through `ctx.effect`.

Use the deferred `artifact` tool to create Markdown plans, HTML widgets, SVGs or
plain documents outside the repository. Pass `supersedes` with the previous
artifact ID to create a revision. Revisions get new IDs and immutable files;
older versions remain readable with `artifact_read`. Content is limited to
2,000,000 UTF-8 bytes. Revision targets must exist on the current branch and
must not already be superseded. The default provider requires a plain filename,
text content, and a nonblank title of at most 200 characters; backend callers may
omit the title to use the filename. It trims the title, validates the session
before writing and publishes the private file without overwriting. Revision
status is checked again when metadata is committed. Failed persistence removes
the new file only when the provider can confirm no artifact entry was recorded;
an uncertain outcome retains the file for recovery.

Open artifacts from the command palette to view every version on the current
branch. The list derives pending, approved and superseded status from that
branch's entries. Only pending versions can be approved. Approval submits a
follow-up to the current conversation and records the approval there, including
when the artifact originated in an ancestor session. SDK consumers import
`Artifact` from `sdk/mod.ts`. Transcript cards show compact metadata and open their exact revision. The
viewer stays docked beside the conversation or editor and can be resized from
its left edge. Passage, HTML element and rectangular area feedback can be staged
and sent in one batch. Numbered pins and visual crops remain under implementation.
Pending Markdown cards also offer Approve & proceed directly; the viewer and card share
busy handling and inline failure feedback.

HTML widgets must be self-contained. Inline scripts and styles run in an isolated
preview; external resources, network requests, forms and nested frames are blocked.
The widget cannot access the app's cookies or document.

### Artifact feedback

For HTML widgets, choose Select element and click a component, or choose Select
area and drag a rectangle. Escape cancels selection. The passage field receives
the DOM hierarchy, classes, text and document bounds in CSS pixels. Area feedback
identifies the element at the rectangle's center. Review or edit these details
before staging; a selection does not send a request.

Select text in the artifact preview, or enter an optional passage, then add a
comment and choose Stage comment. Staged comments survive closing the panel;
unsubmitted text in the comment editor does not. A collapsible tray above the
composer shows staged comments in Agent and Chat modes. Review and send opens
that comment's artifact version in the viewer, where you can edit and submit the
batch. Both surfaces follow saved changes immediately. Send feedback together creates
one revision request for the current conversation. Use Edit to change a staged
comment; save or cancel the edit before sending the batch. Up to 20 comments can be
staged, each with at most 4,000 characters of passage and comment text.

Plugin frontends can call `artifact.feedback.list` with `sessionId`,
`artifact.feedback.stage` with `sessionId`, `artifactId`, `quote` and `comment`,
`artifact.feedback.update` with `sessionId`, comment `id`, `quote` and `comment`,
`artifact.feedback.remove` with `sessionId` and comment `id`, or
`artifact.feedback.send` with `sessionId`. Staged entries follow the
`ArtifactFeedback` shape in `sdk/artifact-feedback.ts`. IDs refer to immutable
artifact versions. A submitted message carries feedback IDs in its attachments
so accepted comments can be reconciled after a lost response. Runtime admission
failure leaves the staged comments available to retry.

## Development-server discovery and browser pairing

`fathom:dev-servers` provides `devServers` (SDK `DevServerService`). Call
`snapshot()` or subscribe with `subscribe(listener)`; dispose the returned listener
with the plugin scope. RPC `dev-servers.list` and project event `dev-servers`
carry the same `DevServersSnapshot`: `{ revision, servers }`. Each server has
`id`, `terminalId`, `sessionId`, and normalized `url`. Filter by session; revisions
are monotonic within an environment, not across plugin reloads.

Discovery consumes existing terminal lifecycle/output events, not a new process
runner. It accepts HTTP(S) on `localhost`, canonical `127.x.x.x`, and `[::1]`,
without credentials. Wildcard binds, LAN hosts, ambiguous IPv4 spellings and
other protocols are rejected. Tokens may span chunks; ANSI CSI and OSC/DCS
sequences may span chunks too. A delimiter is required before publishing, so an
incomplete port is never paired. Memory is limited to a 2 KiB token and 16
candidates per live terminal; terminal exit/stop removes its parser and candidates.
Printed URLs are announcements, not health checks or executable instructions.

`bash` with `background: true` delegates to the existing typed `terminal`
service and returns its terminal identity. Command terminals run `/bin/bash -c`
directly, so command exit ends the terminal instead of leaving an idle shell.
Use `pty` to inspect or stop them. An interactive shell's still-running child
cannot be inferred to have exited from arbitrary text; stop its terminal to
release that discovery lease. Servers that daemonize beyond the terminal lifetime
are intentionally not retained.

BrowserPanel attaches with `browser.attach { sessionId, viewId }`, pairs with the
first current-session candidate, and exposes all candidates through the shared
SearchDialog/SearchList controls. `browser.select-server { viewId, id }` selects
a live candidate. `browser.open { viewId, url }` is explicit navigation and is
not overridden by announcements or terminal exits. Backend callers can instead
supply `sessionId`. Choices/routes survive panel close and session switches in
memory, not application restart. `browser.detach { viewId }` releases only that
view's attachment. `browser-pairing` carries SDK `BrowserPairingState`; pairing
errors carry `{ viewId, message }`. Frames and URL events include the session and
view identity. Navigation is serialized and superseded attachments are hidden.
After a connection or environment restart, the panel creates a fresh view ID,
clears the previous frame, resets discovery revisions, and attaches again. A
plugin-file change notice alone does not restart the current browser view.

Pairing reuses BrowserConnection; it does not implement native child webviews
or browser tabs. The workspace composes browser/Monaco docking separately through
its shared SplitPane. Dev-server hot reload remains the server's responsibility.
Native lifecycle evidence and remaining gaps are recorded in
[the delivery audit](../technical/delivery-audit.md).

## Browser feedback

Open the integrated browser from the command palette, enter an HTTP or HTTPS
address, then choose Annotate and click a point. The inline comment field shares
the artifact feedback control. Stage comment adds a numbered pin; Cancel discards
only the unstaged draft. Staged comments belong to the selected conversation and
can span pages. Batches accept up to 20 comments of 4,000 characters each. A page
change during capture asks you to select again.
Choose Select area and drag a rectangle to capture a visual crop. Escape cancels
the unstaged selection. Area annotations retain viewport-relative `bounds` and
inspect the center element; their PNG contains only the selected rectangle.
Capture adds the current page scroll offset for CDP clipping. New annotations
retain that scroll origin; the frontend uses frame scroll metadata to move their
pins and rectangles with the document. Older annotations without an origin keep
their legacy viewport positioning. Dynamic layout changes and fixed elements
still require selecting again.

Review staged browser comments in the collapsible tray above the prompt, even
after closing the browser. Each row shows its page URL and batch number. Send
browser feedback submits the batch; Clear browser feedback removes its staged
comments. Artifact and browser trays share presentation and session refresh logic.
Both composer trays support Edit, Save comment, Cancel and Remove through the
same list editor. Artifact edits include the optional passage; browser edits
preserve the captured page, position and screenshot. Save persists changes;
Cancel discards only the open edit. Send actions are disabled while editing.

Browser annotations use cached PNG references instead of storing screenshot blobs
in settings. Loading an older tray migrates its embedded screenshots. Submission
attaches screenshots and browser-feedback IDs to one follow-up; accepted or queued
IDs reconcile the draft after a retry. Failed admission preserves it. The public
`BrowserAnnotation` type is exported from `sdk/mod.ts`.

The current vision context includes at most four recent images within its 8 MiB
budget, even when a batch has more screenshots. The artifact tray's Send all
staged feedback action combines artifact and browser drafts in one message.
Dynamic element anchoring and media cleanup remain in progress.

## Register a feedback source

Declare `feedback` in backend requirements and register a source through
`ctx.get("feedback").register(...)`. Keep the returned disposer in `ctx.effect`.
The `FeedbackSource` contract is exported from `sdk/mod.ts`:

- `id`: unique source name, such as `artifacts` or `browser`.
- `prepare(sessionId)`: return `{ count, text, attachments }` for the current
  draft. Validate referenced objects here. Return count zero for an empty source.
  Preparation must not delete drafts or submit a message.
- `reconcile(sessionId)`: remove only IDs already accepted in the session's
  entries or queue. Attach stable feedback IDs during preparation so retries
  can distinguish delivered comments from newer staged comments.

Call `feedback.send(sessionId)` for every registered source, or pass source IDs
as the second argument for a subset. The coordinator prepares the selected
sources, submits one follow-up with their combined text and attachments, then
reconciles drafts. A preparation or admission failure leaves drafts available.
Guard edits and removals with `feedback.isSubmitting(sessionId)` so their data
cannot change during preparation and admission. New comments may be staged;
reconciliation must preserve their IDs.

`fathom:feedback` provides the coordinator; `fathom:feedback-integration` exposes
`feedback.send` to clients. Replacing the service does not require replacing
browser or artifact storage. The built-in guard coordinates one project process;
cross-process submission and forced-crash recovery still require verification.

## Workspace trust decisions

Opening an unreviewed workspace shows the trust dialog. Choosing Restricted Mode
is remembered for that canonical project path; its status badge remains available
for changing the decision later. Project plugins remain disabled until trusted.
The `project.trust` RPC requires a boolean `trusted` value. Changing it reloads
that project's environment; recording an unchanged restricted choice does not.
`Project.trustReviewed` distinguishes an explicit choice from a new workspace.

## Observing active work

`runtime.state(sessionId)` returns the durable session plus the current run's
optional `activity: { label, since }`. The inspector uses this to distinguish
context preparation, compaction, provider waits, response reception, tool work,
retry waits and review. Activity is in memory and disappears when the run settles.
Use `session.status` for control flow; activity labels are presentation text.

The events service publishes `session` when activity changes and `usage` when a
usage record is saved. Consumers can refresh their snapshots through the existing
session and usage APIs. Usage updates include internal model operations such as
compaction, so displays do not have to wait for the next transcript entry.
