# Fathom architecture

Fathom is a coding harness where every feature is a plugin. This document draws
one line from the person using the app, through the person writing a plugin, to
the code Fathom itself keeps. Anything not on this line is a mistake.

## Three people

| Person | What they touch | What they never see |
| --- | --- | --- |
| End user | `Fathom.app`. The workspace, settings, providers, and plugin manager. Installs, disables, and replaces plugins. | Kernel, server, renderer, window code. |
| Plugin author | One directory with `deno.json`, `backend/mod.ts`, `ui/mod.tsx`. Imports `@fathom/sdk` and `@fathom/sdk/ui` from JSR. Other plugins' `contract` exports. | Kernel, server, renderer, window code, the build toolchain. |
| Fathom maintainer | Everything, including the harness and the bundled plugins. | Nothing. |

## The line

```text
End user
  Fathom.app ── one window ── workspace shell (plugin) ── pages, settings, status (plugins)
                                    │
Plugin author                       │ contributes to slots, provides and requires services
  plugins/<id>/                     ▼
    deno.json        { "fathom": { "id", "backend", "ui" } }
    backend/mod.ts   definePlugin({ requires, provides, start })   imports @fathom/sdk
    ui/mod.tsx       definePlugin({ requires, start })             imports @fathom/sdk, @fathom/sdk/ui
    contract.ts      tokens and schemas other plugins import       exported as @scope/<id>/contract
                                    │
SDK (published to JSR)              ▼
  @fathom/sdk        definePlugin, defineService, defineRegistry, defineApi, schemas,
                     Api, Storage, AppEnvironment, KernelControl, composition types
  @fathom/sdk/ui     slot registries (AppShell, Pages, SettingsSections, HeaderActions,
                     StatusItems, LeftSidebar, RightSidebar), Slot, Client, Appearance,
                     controls (Button, Card, Dialog, Menu, Tabs, …), IconName
  @fathom/sdk/ui/styles.css   theme tokens, fonts, base, typography, control styles
                                    │
Harness (Fathom internals, not published, not replaceable)
  kernel     plugin lifecycle: dependency graph, scopes, leases, serialized change, rollback
  server     Deno process: discovers plugins, runs backend plugins, loopback HTTP + SSE, serves the page
  renderer   the page: loads UI plugins, runs the UI kernel, renders slots, recovery panel
  app        composition root: window, menu, lifecycle, picks native window or browser fallback
                                    │
Runtime                             ▼
  Deno process (files, sockets, SQLite, subprocesses)   │   page in the window (DOM, Solid)
```

## What is a plugin and what is harness

The test: if a user could reasonably want it different, it is a plugin. The
harness is only what a plugin needs in order to exist at all.

| Plugin (replaceable) | Harness (fixed) | Why fixed |
| --- | --- | --- |
| storage, credentials, llm, provider-* | kernel | Lifecycle rules must be the same for every plugin or nothing composes. |
| workspace shell, settings pages, plugin manager | server transport and loaders | Something has to load the first plugin and carry requests between the two runtimes. |
| sessions, tools, approvals, agent loop, conversation UI, composer (roadmap) | renderer root and recovery panel | Recovery must survive removal of every UI plugin. |
| theme selection, commands, editors (later) | window, menu, lifecycle | The process must open a window before any plugin runs. |

The harness has no feature behavior. If a harness module starts knowing about
models, sessions, or providers, it belongs in a plugin.

## Plugin author journey

1. Create `plugins/example/deno.json`:

   ```json
   {
     "name": "@you/example",
     "version": "0.1.0",
     "exports": { "./contract": "./contract.ts" },
     "imports": { "@fathom/sdk": "jsr:@fathom/sdk@^0.1" },
     "fathom": { "id": "example", "backend": "backend/mod.ts", "ui": "ui/mod.tsx" }
   }
   ```

2. `contract.ts` defines tokens and schemas. No runtime resources. Token
   identity is the string id, so a second SDK copy or an inlined UI bundle still
   matches.
3. `backend/mod.ts` declares `requires` and `provides` and wires named
   implementations from sibling files. It runs in the Deno process with host
   privileges.
4. `ui/mod.tsx` declares `requires` and contributes components to slots. It runs
   in the page. Controls come from `@fathom/sdk/ui`; utility classes compile per
   plugin against the SDK theme.
5. Register the directory once with `mise run plugin:add`, then run Fathom.
   The server builds the UI entry, the kernel starts the backend entry, and the
   plugin manager shows both with enable, disable, reload, and configure.
6. Replace a bundled plugin by providing the same service token or contributing
   to the same slot, then disabling the original. Nothing in Fathom is imported
   by name except the SDK and other plugins' contracts.

## SDK packaging

One JSR package, `@fathom/sdk`, with these exports:

| Export | Runs in | Contains |
| --- | --- | --- |
| `.` | both | plugin definition, tokens, schemas, API and storage contracts, environment, composition types |
| `./ui` | page | slot registries, `Slot`, `Client`, `Appearance`, controls, `IconName` |
| `./schema` | both | TypeBox re-export |

The stylesheets (`src/ui/theme/styles.css`, `theme.css`, `typography.css`) ship
as files in the package, located relative to the `./ui` entry; JSR exports are
modules only.

Why one package and not `@fathom/sdk` plus `@fathom/ui`:

- A plugin author installs one thing at one version. The UI half is useless
  without the contracts half.
- The SDK already depends on `solid-js` for `Slot`, so a separate package saved
  no dependency.
- Two packages meant two publishes, a version pin between them, and a third
  runtime singleton in the import map.

Rules inside the package:

- `src/ui/controls/` imports `solid-js` only. Controls take props and children.
  They never import tokens, the client, or the kernel. This is a folder rule,
  not a package boundary.
- The build toolchain (esbuild, Babel, PostCSS, Tailwind) is not in the SDK. It
  lives in `scripts/` and the SDK has no dependency on it.
- `deno publish --dry-run` must pass; `mise run publish:check` runs it. It joins
  `check` once the repository has a license.

Runtime singletons shared by the renderer and every UI plugin:
`solid-js`, `solid-js/web`, `solid-js/store`, `@fathom/sdk`, `@fathom/sdk/ui`.

## Repository

```text
apps/desktop/          The application. main.ts, window.ts, browser.ts, page/index.html, page/main.tsx
packages/
  sdk/                 Published. src/*.ts contracts; src/ui/{controls,theme}/ and slot contracts
  kernel/              Internal. Lifecycle engine, runs in both runtimes.
  server/              Internal. Deno process runtime.
  renderer/            Internal. Page runtime.
plugins/               Bundled plugins. Each is exactly what a third party would write.
examples/counter       The hero plugin the guides walk through; registered with plugin:add.
scripts/               dev.ts, build-ui.ts, new-plugin.ts, install-plugin.ts, bundling/
design/                Visual reference. Read, never reorganized.
docs/                  concepts, guides/, standards/, plans/, this file
```

Dependency direction, enforced by review:

```text
plugins ──▶ sdk ◀── kernel ◀── server, renderer ◀── apps/desktop
plugins ──▶ other plugins' /contract exports only
nothing ──▶ plugins (the harness discovers them, never imports them)
```

## Roadmap

Every remaining feature is a plugin with its own plan: sessions, tools,
approvals, coding tools, agent loop, conversation UI, composer and drafts. Each
exports a `contract` so the next plugin, or a replacement, builds on it. See the
[roadmap](plans/README.md), which also lists deferred foundation work.
