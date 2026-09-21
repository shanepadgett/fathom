# Plugins

A plugin is one directory with a `deno.json` and up to two entries. Bundled
plugins live in `plugins/<id>/` and are exactly what a third party would write.

## Layout

```text
plugins/<id>/
  deno.json          name, version, exports, fathom { id, backend, ui }
  contract.ts        tokens and schemas others import; no runtime state
  backend/mod.ts     definePlugin: requires, provides, config, start; wiring only
  backend/*.ts       implementations, named for their responsibility
  ui/mod.tsx         definePlugin: requires, start; adds to slots, wiring only
  ui/*.tsx           one PascalCase file per named component
```

Scaffold with `deno task new <id>`. Add `plugins/<id>` to the root `deno.json`
workspace. A plugin without a UI or backend half omits that entry and folder.

## Rules

- `mod.ts` and `mod.tsx` declare dependencies and wire named implementations.
  No feature logic, no whole views.
- Import other plugins through their `@scope/<id>/contract` export, never by
  relative path. The loader copies each plugin before importing it.
- Import Fathom through `@fathom/sdk` and `@fathom/sdk/ui` only. Nothing in
  `packages/kernel`, `packages/server`, or `packages/renderer` is a plugin
  dependency.
- Every value crossing runtimes has a schema: `defineApi` operations, events,
  registry entries, `config`. Validate at the boundary and use the decoded type
  inside.
- `requires` keys are the names you receive on the start context. `scope` and
  `handoff` are reserved.
- Return exactly the services listed in `provides` from `start`.
- Cleanup goes through `scope.defer`, background work through `scope.task`.
  Registrations made during `start` are released for you.
- Configuration is a `config` schema with `default` and `description` on each
  field. The plugin manager renders it as a form. Flat objects render as
  fields; anything else falls back to JSON.
- State has one owner. Login sessions own their pending replies; credential
  access owns refresh and removal. Do not spread a state across flags.
- Providers own their authentication headers and endpoints. Protocol modules
  own wire formats. Never add a central provider switch.

## Change a plugin

1. Edit under `plugins/<id>/`. With `deno task dev` running, UI edits rebuild
   and reload the page half; backend edits reload the process half.
2. Confirm in **Settings → Plugins** that the plugin is `ready`. A `blocked`
   plugin lists the token ids it waits on; `failed` shows the error.

## Add a bundled plugin

1. `deno task new <id>`, then add the directory to the workspace in the root
   `deno.json`.
2. Add `"lint": { "rules": { "exclude": ["no-slow-types"] } }` to its
   `deno.json`. That rule applies to the SDK only.
3. Start `deno task dev`. Bundled plugins start enabled; the counter example
   and other external directories are added with `deno task plugin:add` and
   start disabled.
