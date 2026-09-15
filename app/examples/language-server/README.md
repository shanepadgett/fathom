# Local language-server plugin

This example registers an **already installed** `rust-analyzer` stdio binary and
a browser-side Rust syntax grammar. It does not download binaries. If the binary
is absent, the plugin still activates, the registration reports `unavailable`,
and editing continues with empty LSP results. The frontend grammar still
highlights Rust files without a working server.

## Install the plugin (not the server)

From the Fathom checkout, choose **one** scope:

```sh
# Global: applies to workspaces on this machine.
mkdir -p "${FATHOM_HOME:-$HOME/.fathom}/plugins/language-server"
cp app/examples/language-server/plugin.js \
  "${FATHOM_HOME:-$HOME/.fathom}/plugins/language-server.js"
cp app/examples/language-server/view.js \
  "${FATHOM_HOME:-$HOME/.fathom}/plugins/language-server/view.js"

# Or repository-local: run with the target repository as cwd,
# replacing /path/to/fathom with the checkout location.
mkdir -p .fathom/plugins/language-server
cp /path/to/fathom/app/examples/language-server/plugin.js \
  .fathom/plugins/language-server.js
cp /path/to/fathom/app/examples/language-server/view.js \
  .fathom/plugins/language-server/view.js
```

Trust repository plugins and reload the environment from Fathom's plugin reload
notice or Settings. Global plugins run with Fathom's privileges. The native app
must be able to find the command on its own `PATH`; edit `command` to an
absolute binary path if necessary. No shell expansion occurs. Remove the
installed file, or add `example:language-server` to that scope's
`fathom.disables`, then reload to unload it and clean up its process. Reload
after making a previously missing binary available; failed servers are not
automatically restarted.

## Backend API

Declare `requires: ["lsp"]`, obtain the typed `LspService` with
`ctx.get("lsp")`, and scope every registration with:

```js
ctx.effect(() =>
  ctx.get("lsp").register({
    id: "rust-analyzer", // stable, unique id
    name: "Rust Analyzer", // display name
    command: "rust-analyzer", // local executable; no shell
    args: [],
    languages: { ".rs": "rust" }, // lowercase suffix -> LSP language id
    initializationOptions: { checkOnSave: false }, // JSON data, copied on register
    priority: 0,
  })
);
```

The returned idempotent async disposer unregisters **only its own registration**
and awaits process cleanup. `ctx.effect` binds it to the plugin's Cordis scope.
The editor plugin provides the service under `lsp` and registers Deno as `deno`
at priority zero using the existing native runtime executable resolution.

- Higher priority wins among matching healthy registrations. Equal priorities
  use ascending, case-sensitive id order (not locale or activation order). File
  suffix matching is case-insensitive; the longest suffix within a registration
  determines its language id.
- Duplicate ids throw unless the second argument is `{ replace: true }`.
  Replacement **permanently retires** the previous registration and process;
  disposing the replacement does not restore it. A stale disposer cannot remove
  the replacement. Prefer a distinct id and higher priority for a scoped
  override that falls back to Deno when removed or unavailable.
- All registered servers start concurrently. A missing binary, initialization
  failure, or transport timeout marks only that server unavailable. Routing
  skips unavailable servers, trying the next matching registration. With none,
  updates are harmless and completions/diagnostics are empty. Existing documents
  are resynchronized when registrations or availability change.
- `update(path, text)` synchronizes the latest buffer;
  `completion(path, text,
  position)` returns the existing
  `{ isIncomplete, items }` shape. Positions are zero-based UTF-16. Per-document
  operations are serialized.
- `getDiagnostics(paths)` returns `{ path, uri, serverId?, diagnostics }[]` for
  distinct requested files, using latest supplied buffers and opening untracked
  files from disk. Paths in results are workspace-relative. Up to 3000 paths are
  accepted. Direct SDK calls enforce workspace/symlink authorization, valid
  positions, text-only content, and the same 4,000,000-byte editor limit as
  RPCs.
- `servers()` returns every effective registration with id/name, priority,
  languages, `state` (`starting`, `running`, `unavailable`), running/error
  fields, and isolated error/warning counts. `status()` preserves the legacy
  Deno summary; `status(path)` reports the selected (or highest-ranked
  unavailable) server for an authorized path.

Existing file RPCs and `lsp.completion` keep their result shapes. `lsp.status`
retains its no-argument Deno behavior and optionally accepts `{ path }`.
`lsp.servers` returns the full status array. `lsp.diagnostics({ path })` returns
that file's diagnostic array, as does the `diagnostics` field of `file.read`.
The built-in `lsp_diagnostics` tool and file-tool hooks use this same gateway,
including unsaved-buffer protection; there is no second agent-side LSP client.
`diagnostics` events retain `uri` and `diagnostics` and add `serverId`; status
changes still emit `language-server` events.

## Protocol support and limits

The implementation reuses `LanguageServer` and the installed
`vscode-jsonrpc/node` stream reader/writer, connection, and cancellation APIs.
The installed package README documents stdio wiring; its connection declarations
and implementation distinguish cancellation from disposal: cancellation sends a
request to the peer, while disposal rejects retained pending requests. Timed-out
transports are disposed rather than accumulating unanswered requests.

- Startup has an 8-second deadline including `initialized`. Individual writes
  and completion requests have 3-second deadlines. The service completion call
  additionally bounds queue/startup/synchronization time to 15 seconds after
  path authorization. Timeouts return empty completions and retire the failing
  transport; a later operation uses a healthy fallback.
- Completion requests are sent only when the selected server advertises a static
  `completionProvider`. Unsupported requests, content-modified responses, and
  server-side cancellation return empty completions without retiring a healthy
  server. A diagnostics-only server remains the document owner; its lack of
  completion support does not change routing to a different server.
- Diagnostic batches authorize and synchronize four files at a time. All editor
  disk reads share a four-reader limit, including simultaneous RPC/service
  calls. Reads use small, at-most-64-KiB chunks and enforce the byte limit while
  reading, including files that grow after stat. Open document text remains
  cached until environment disposal; this is not a memory-bounded repository
  indexing API.
- Full and incremental text synchronization are supported (incremental mode uses
  one UTF-16 edit replacing the previous whole document). Initialization options
  also supply `workspace/configuration` responses, either as the whole value for
  an empty section/server id or by nested section lookup.
- Diagnostics are **latest asynchronous push results**, not a repository scan or
  a guarantee that compilation has finished. Only documents opened through the
  service contribute diagnostics. Versioned stale reports are ignored; servers
  omitting versions cannot guarantee freshness. Ownership changes, edits, exits,
  and unregistering clear old markers. Other servers cannot overwrite them.
- This is not a full LSP client: no pull diagnostics, completion-item resolve,
  file watchers, dynamic registrations, workspace edits, formatting, or semantic
  tokens. Unsupported server requests receive JSON-RPC MethodNotFound. Commands
  run in the workspace cwd, not in separately discovered language-project roots.
- Shutdown attempts the LSP `shutdown`/`exit` handshake for 1.5 seconds, then
  kills the process tree and disposes RPC streams. POSIX servers use a dedicated
  process group; Windows uses the OS `taskkill /T /F` utility. Servers must not
  deliberately detach helpers into unrelated sessions/process trees.
- Servers execute with application privileges and may invoke their own build
  tooling. `checkOnSave: false` avoids the example's save-time check, but does
  not sandbox the server. Install only trusted plugins and executables.

The session inspector lists registered servers and their connection states. The
editor reports availability for the server selected for its active file.

## Frontend syntax

The browser module awaits `host.registerLanguage` with a stable id, lowercase
extensions, a Monaco Monarch grammar and optional editor configuration. The host
scopes registrations to the project and disposes tokenizers and configuration on
unload. Open editor and diff models immediately fall back when it unloads.
Higher priority wins; equal priorities sort by id. Duplicate ids in one project
are rejected. Language identities remain reserved internally for reuse because
Monaco does not expose language-id unregistration.

The example grammar covers common Rust keywords, comments, strings, numbers and
punctuation. It is a starting point, not a complete Rust parser; raw strings and
complex numeric forms can be extended in `view.js`. Tokenization does not
provide compiler diagnostics or require the backend server to be installed.
