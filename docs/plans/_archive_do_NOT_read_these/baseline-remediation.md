# Baseline remediation

Review of the baseline implementation against [baseline.md](baseline.md). The
kernel, hosts, and reload/rollback machinery match the plan and work. The problems
are in where code lives and in how much an author has to type. Nothing here needs a
rewrite. The kernel stays. The SDK shrinks. The plugins grow to own their own stuff.

Guiding test for every item: could an outside author build this plugin, from the
public SDK alone, with the same code our plugin uses? If the answer is no, fix it.

## Implementation status

Stages 1–3 are implemented. The critique below records the original findings.
The current interfaces and ownership are documented in
[plugin authoring](../plugin-authoring.md).

- Feature contracts are named plugin packages. Providers contribute behavior.
  Credentials own their store and login helpers; OpenAI owns its device flow.
- UI styles and the model workbench belong to their plugins. `ui` points at source.
  The SDK builds one plugin; the host builds and assembles the application.
- API publication and storage resolve through consumer scopes. Registries use
  typed keys, local contribution names, direct lookup, and disposable leases.
- The kernel loads source intent and reports import failures directly.
  Backend generation cleanup retains sources needed for rollback.
- The plugin manager owns management UI. The browser host supplies async
  `KernelControl`, a narrow `Client`, scoped slot settings, and a small UI recovery
  surface. Event delivery, API dispatch, and static serving are separate host modules.
- Removed the old AI entry point, hook/middleware helpers, single-slot setting,
  slot mutation globals, unused migrations table, stale build output, and temporary
  manual-check plugin and data.

Manual checks covered external plugin installation, scoped SQLite persistence,
typed API events, nested backend reload, UI/CSS reload, bad configuration,
activation rollback with handoff, lease drain, duplicate registry keys, rejected
slash-containing contribution names, import failure recovery, dependency blocking,
workspace/plugin-manager recovery, replay-gap reset, and process restart.
Saved OpenAI and xAI connections restored, both live model catalogs loaded, and
both providers completed a streamed request. The unconnected Anthropic adapter
was checked with a local Messages response.

Type checking, a clean UI build, and formatting checks pass. Source lint passes
with the JSR publication-specific `no-slow-types` rule excluded; package publication
remains deferred. The user's instruction to add no tests or validation scripts
also applies to the open question below.

## Stage 1: ownership (do first)

### 1. Feature contracts are in the SDK

`packages/sdk/src/contracts/mod.ts` defines `Credentials`, `Logins`, `CredentialsApi`,
`Providers`, `Llm`, `LlmApi`, and their schemas. The SDK knows about logins and
language models. An outside author cannot add a feature this way, so our plugins are
not built like theirs.

Fix. Each plugin owns its contract file. It exports the file as a workspace package
so other plugins import it by name, not by relative path (relative imports break
when the loader copies a plugin directory).

```
plugins/llm/deno.json         { "name": "@fathom/llm", "exports": { "./contract": "./contract.ts" } }
plugins/llm/contract.ts       Llm, LlmApi, Providers, ModelSchema ...
plugins/credentials/contract.ts
```

Consumers write `import { LlmApi } from "@fathom/llm/contract"`. Tokens match by id
string, so a UI bundle that inlines a copy of the contract still works. Add the plugin
packages to the root `deno.json` workspace. Outside authors do the same with an import
map entry or JSR later.

Keep in the SDK: `AppEnvironment`, `Storage`, `Apis`/`ApiBridge` (see item 6),
`KernelControl`, manifest and composition schemas.

### 2. Provider protocol is a closed list in the SDK

`Provider.protocol` is `"anthropic-messages" | "openai-responses" | "openai-chat"`.
`packages/sdk/src/ai/protocols.ts` switches on it. `Provider` also carries
`oauthBaseUrl` and `oauthModelsPath`, which are OpenAI details. Adding a Gemini
plugin means editing the SDK.

Fix. A provider entry carries behavior, not a label:

```ts
interface Provider {
  id: string;
  label: string;
  models(credential: Credential, signal: AbortSignal): Promise<ModelInfo[]>;
  stream(input: { model: string; prompt: string }, credential: Credential, signal: AbortSignal): AsyncIterable<string>;
}
```

Move `protocols.ts` into the provider plugins. Shared protocol code (Responses,
Messages) can live in `plugins/llm/protocols/` and be exported like the contract, so
provider plugins import it. The `llm` plugin becomes: pick provider, get credential,
call it.

### 3. `@fathom/sdk/ai` holds plugin implementation

- `openCredentialStore` is the credentials plugin's private file store. Move it to
  `plugins/credentials/backend/store.ts`.
- `loginOpenAIDevice` is OpenAI only. Move it to `provider-openai`.
- `loginPkce`, `loginDeviceCode`, `refreshOAuth`, `refreshDeviceCode` are generic
  login helpers. They can stay in the SDK as `@fathom/sdk/auth`, or move to a
  `plugins/credentials/helpers` export. Pick one. Prefer moving them: the SDK should
  not need to know what OAuth is.
- `readSse`, `delay`, `request` are transport helpers used by the browser host
  through a relative path (`../sdk/src/ai/transport.ts`). Move them to
  `packages/sdk/src/transport.ts` and export from the SDK root. Delete the `ai`
  entry point when it is empty.

### 4. Plugin styles live in the app

`apps/ui/styles.css` (383 lines) styles the workspace masthead, the credentials
workbench, and the plugin-manager panel. The manifest supports `styles` and CSS
imports, but no plugin uses them.

Fix. Each UI plugin gets `ui/styles.css` and imports it from `mod.tsx`. The app
keeps only the `#app` reset. While here, simplify the manifest: `ui` is the source
entry (`"ui": "ui/mod.tsx"`). Drop `uiSource`. The current `ui/dist/entry.js` value
is never written or read.

### 5. Build tool points the wrong way

`packages/sdk/src/dev/build-app.ts` imports `discover` from `host-deno`. The SDK
depends on a host.

Fix. Split it. The SDK exports one function, `bundleUi(pluginDir)`, that compiles
one plugin into `{ js, css }`. That is the author-facing build. The host owns
`packages/host-deno/build.ts`, which discovers plugins, calls `bundleUi`, writes
content-addressed files, builds the app shell and singletons. `deno task build:ui`
points at the host build.

## Stage 2: simpler author surface

### 6. Three tokens to publish one API

A backend plugin that serves an API requires `Apis`, `ApiBridge`, and calls
`Storage.namespace(pluginId)` and `add(value, { id: "my-plugin/thing" })`. The
author repeats their own plugin id everywhere. The kernel already knows it.

Fix. Add one small kernel feature: a host service can be a factory of the consumer
scope. `kernel.provide(token, (scope) => value)`. Registries already work this way
(`registry.view(scope)`); this makes services match. Then:

- `Api` service: `use.api.serve(LlmApi, handlers)` returns `{ emit, dispose }`.
  Internally it adds to a host registry with the caller's scope, so leases and
  drain still work. `Apis` and `ApiBridge` collapse into one token.
- `Storage` service is already namespaced: `use.storage.get("key")`.
- `registry.add(value, { id: "provider" })` becomes `my-plugin/provider`
  automatically. Reject ids that contain `/`.

### 7. Registry lookup and leases are clumsy

Every consumer does `entries().filter(e => e.value.id === x)`, checks `length === 1`,
then `lease(entries[0].id)`. This pattern is in `llm`, `credentials`, and the bridge.

Fix.
- `defineRegistry<E>(id, { key: (e) => e.id })`. A typed function instead of the
  string path `"token.id"`.
- Keyed registries get `get(key): Entry<E> | undefined` and `lease(key)`. Unkeyed
  registries lease by entry id as now.
- `Lease` gets `[Symbol.dispose]` so callers can write `using lease = ...` and drop
  the try/finally.
- `single` is declared but never enforced by the kernel and never used. Remove it,
  or enforce it in `add`. Remove for now.

### 8. Kernel should load plugins itself

Both hosts build a `DenoLoader`/`BrowserLoader`, call `load` in a loop, and on
failure wrap the error in a fake `definePlugin({ start() { throw error } })`. The
kernel already has a `loader` and calls it on reload.

Fix. `kernel.add({ id, source, config, enabled })` records intent. `startAll` calls
`loader.load` when a record has no definition. A load failure is `state: "failed"`
with `lastError`, same as a start failure. `host-deno/mod.ts` loses about 25 lines,
`host-browser/mod.ts` about 20, and the duplicate loader goes away.

### 9. Management UI is in the SDK

`RuntimeControls` (the full enable/disable/reload/config panel) lives in
`@fathom/sdk/ui` and is rendered by both the host recovery bar and the
`plugin-manager` plugin. The plugin is a 20-line wrapper.

Fix. Move `RuntimeControls` into `plugins/plugin-manager/ui`. The host recovery
surface gets a tiny host-owned component: connection state, load errors, and a
button per UI plugin that is disabled or failed. Nothing more.

### 10. Browser `Client` is a grab bag, slots use module globals

`ClientApi` mixes transport (`api`, `onReset`, `connection`) with management
(`plugins`, `graph`, `operations`, `change`). `configureSlots`/`saveSlots` are
mutable globals inside `@fathom/sdk/ui`; `saveSlots` is unused.

Fix. `Client` keeps `api`, `onReset`, `connection`. Management moves to a browser
host service implementing `KernelControlApi` (async) that merges local and remote.
Slot settings become a `Slots` host service that `Slot` reads through context, or
move into the `Client`. Delete `saveSlots` until a plugin needs it.

## Stage 3: cleanup

- Remove `defineHook` and `pipe`. Unused. The tools plan adds middleware when it
  has a real caller.
- Remove the `migrations` table in `storage`. Unused.
- Remove `Kernel.add`'s `async`. It does nothing async.
- Rename `Kernel.external` to something that says what it does, such as
  `setHostService`.
- Delete old generation directories under `~/.fathom/artifacts/<id>/` after a
  successful start. Five copies of `credentials` are there now.
- The `credentials` UI panel also holds the "try a model" form and requires
  `LlmApi`. Move that form into an `llm` UI entry so each plugin's UI matches its
  backend scope.
- Split `bridge.ts` into event bus, API dispatch, and static serving. Host only;
  low priority.

## Open question

The plan said no test suite for the baseline. The kernel's rollback, drain, and
handoff paths are the part of the system every future plugin depends on. I would
add a small `deno test` for `packages/kernel` as part of Stage 2, while the
behavior is being touched. Your call.

## Order of work

1. Items 1 to 5 together. They move files and change imports; do them in one pass
   and re-run `deno task check`, `deno task build:ui`, `deno task dev`.
2. Items 6 to 8. Kernel and SDK signature changes; update every plugin.
3. Items 9 and 10. UI surface.
4. Stage 3 as time allows.

Repeat the manual checks in [baseline.md](baseline.md#completion-checks) after each
pass. Update [plugin-authoring.md](../plugin-authoring.md) when signatures change.
