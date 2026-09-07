# Technologies and Versions

Version sources checked on 7 September 2026. These are planning decisions, not
production-installed dependencies. The
[integration prototype](integration-prototype.md) records tested combinations
and their remaining limits.

## Agreed Foundation

- Deno: **2.9.6**, the current stable release reported by the
  [official release endpoint](https://dl.deno.land/release-latest.txt).
- TypeScript: use Deno's bundled compiler rather than select a separate compiler
  package. Deno 2.9.6 reports bundled TypeScript **6.0.3**.
- Desktop: built-in `deno desktop`, versioned with Deno. The
  [Deno 2.9 announcement](https://deno.com/blog/v2.9#deno-desktop) confirms
  native desktop support and labels it experimental in 2.9. The combined
  prototype builds and launches on macOS ARM64 with CEF.
- TypeBox: **`npm:typebox@1.3.28`**, the current
  [`typebox` package](https://registry.npmjs.org/typebox/latest). This replaces
  the older `@sinclair/typebox` choice. Compatibility with `pi-ai` remains to be
  checked. The integration prototype uses **1.3.27** with user approval because
  Deno's dependency-age policy rejected **1.3.28** at installation time.
- Cordis: **`npm:cordis@4.0.0-rc.9`**, the current release candidate.
  Release-candidate status is accepted. Compatibility checks with Deno modules
  remain to be performed during prototyping.
- Model gateway: **`npm:@earendil-works/pi-ai@0.85.1`**, the
  [current npm latest release](https://registry.npmjs.org/@earendil-works/pi-ai/latest).
  Its metadata pins `typebox` to **1.3.7**, so it uses the selected package line
  but not our exact version. Keep its dependency unchanged; check schema
  interoperability with our **1.3.28** pin before implementation. The package
  declares Node **>=22.19.0**. The earlier prototype demonstrated live model and
  OAuth operation; the combined prototype loads **0.85.1** but has not made a
  live model call with that patch.

## SQLite Access and Migrations

Drizzle ORM is selected for typed schemas and queries, using Deno's built-in
`node:sqlite` driver. Drizzle Kit will generate SQL migration files for review
and shipping with the app. Raw SQL remains available for queries such as walking
session trees.

The release-candidate status is accepted. The integration prototype pins both
`drizzle-orm` and `drizzle-kit` to **1.0.0-rc.4** and verifies migration
generation, application, persistence, and restoration under Deno. The
[official SQLite integration docs](https://orm.drizzle.team/docs/get-started-sqlite#nodesqlite)
document the driver connection.

Type checks do not replace runtime validation or database constraints.
`node:sqlite` remains synchronous; where database work runs and how migrations
are applied remain architecture decisions.

## Terminal

xterm.js is selected for terminal display, using **`npm:@xterm/xterm@6.0.0`**
and **`npm:@xterm/addon-fit@0.11.0`**, paired with
**`jsr:@sigma/pty-ffi@0.42.0`** for interactive shells on the server.

`pty-ffi` wraps Rust's `portable-pty` through Deno FFI. Its
[official documentation](https://github.com/sigmaSd/deno-pty) describes bundling
the native library with `deno compile`. The combined prototype verifies shell
output, resizing, and macOS desktop bundling. Other platforms and arbitrary
descendant-process cleanup remain unverified. Native binaries must ship with the
app for each supported target.

## Code Editor and LSP

Monaco Editor is selected for the embedded code editor and diff engine, pinned
to **`npm:monaco-editor@0.56.0`**. For the backend LSP gateway,
**`npm:vscode-jsonrpc@9.0.2`** handles communication with the host `deno lsp`
process using its exported `/node` entry point. The integration prototype
verifies shared diagnostics between the editor markers and agent tools.

## UI Framework and Bundling

Solid is selected for the desktop frontend, pinned to **`npm:solid-js@1.9.15`**,
bundled with **`npm:vite@8.2.2`** and **`npm:vite-plugin-solid@2.11.14`**. The
integration prototype verifies clean rendering, reactivity, and CEF desktop
packaging without runtime errors.

## MCP

Use **`npm:@modelcontextprotocol/client@2.0.0`** to connect Fathom's server to
external MCP servers. This is the
[current stable client release](https://registry.npmjs.org/@modelcontextprotocol/client/latest);
the
[official SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk)
lists Deno support. The combined prototype verifies local stdio and Streamable
HTTP fixture calls, including calls from Deno scripts through Fathom's server.

Support both stdio for local tool-server processes and Streamable HTTP for
remote tool servers. The SDK handles protocol communication; Fathom owns tool
discovery, permissions, and the required `fathom:mcp` script interface. The
SDK's Zod dependency does not replace our TypeBox choice.

## Script Execution

Ordinary scripts run in separate processes using the selected host interpreter,
with the operating system access of the user running Fathom's server. No added
file or network sandbox is selected. The existing approval pipeline still
applies to every script execution, including reruns after edits; it may
auto-approve or escalate to the user as defined in the requirements.

Keep timeouts, cancellation, bounded output, and saved-script editing. Process
separation is not a security sandbox and does not protect files or credentials
that the server user can access.

## Deferred

Start Markdown rendering with **`npm:markdown-it@15.0.1`** and
**`npm:shiki@4.4.3`**, verified in the integration prototype. The agreed future
goal is an independently implemented, clean-room streaming Markdown renderer
inspired by Streamdown's behavior, without copying its source. This is deferred
work, not part of the initial build commitment.

CLI frontend planning and its framework choice are deferred. This does not
remove the CLI client requirement; preserve room for it in the architecture.
