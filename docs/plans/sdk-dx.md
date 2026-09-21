# SDK and developer experience

Fathom will not be adopted on architecture. It will be adopted if a stranger can
write a useful plugin in an afternoon and replace a bundled one in a week. This
document measures the current SDK against published SDK-design principles and
against the DeepSeek Harness, then lists the changes that follow.

## Principles

Sources: Bloch, *How to Design a Good API and Why it Matters* (OOPSLA 2006);
Azure SDK general guidelines; Damien Guard, *Developing a great SDK*; Auth0,
*Guiding principles for building SDKs*; VS Code extension anatomy (contribution
points and activation); Obsidian plugin lifecycle.

| Principle | What it means for a plugin SDK | Source |
| --- | --- | --- |
| Hero scenario first | Write the ideal plugin before the SDK. The SDK exists to make that file short. | Guard |
| Small, then no smaller | Every concept the author must learn is a cost. Remove any that a plugin can do without. | Bloch |
| Progressive disclosure | The first plugin uses two ideas. Leases, handoff, and registries appear only when needed. | Azure, Guard |
| Names carry the model | If a name needs a glossary entry, the model is leaking. Prefer words the audience already owns. | Bloch |
| Hard to misuse | Types and fail-fast validation, not documentation, prevent the common mistakes. | Bloch |
| Declare statically, run lazily | The manifest says what a plugin contributes. Code runs only when needed. | VS Code |
| Register, never unregister | Everything registered through the context is released with the plugin. Authors write no cleanup for the common case. | Obsidian, Cordis |
| Diagnosable | When a plugin does not start, the tool says which dependency is missing and where. Silence is a bug. | Azure |
| Zero to success in minutes | One command scaffolds, one command runs with reload, one command installs. | Auth0, Guard |
| Ship platform pieces separately | The SDK a plugin imports carries no build toolchain and no host code. | Guard |
| Dependable | Contracts are versioned by string id and schema. Breaking a published contract is the most expensive change available. | Azure |
| Docs are the product | Quickstart, concepts, task guides, reference, in that order, and never mixed. | Auth0 |

## The DeepSeek Harness, measured

Verified from its docs and from the source at the local reference checkout.

What it does well:

- **Three ideas to start.** A plugin is a module exporting `apply(ctx)`, an
  optional `name`, and an optional `inject` list. The first plugin is four lines.
- **Cleanup is automatic.** Anything registered through `ctx` is an effect and is
  released on unload. `ctx.effect()` exists for the manual case.
- **Config is one schema.** Export `Config`; the framework validates, applies
  defaults, and hot-replaces the plugin on edit. A generated config catalog
  pastes every plugin's schema and its required services into the docs, and a
  gate verifies the schema against the declared type.
- **The frontend is a plugin system too.** React 18, a framework-free slot core
  with `single`, `list`, `keyed`, and `chain` slots, about 45 UI feature plugins,
  a `ui-primitives` package that is the only allowed cross-package UI import,
  i18n registration, and per-slot typing by declaration merging. The same
  package ships both halves through `exports["."]` and `exports["./client"]`.
- **Typed RPC.** Host methods marked `@Remote` are generated into a wire endpoint
  and a client type; the page calls `ctx.remote.<ns>.<method>()`. Errors are one
  class with `domain/reason` codes.
- **The plugin manager is a product.** Add from npm name, git address, tarball,
  or path, with pre-flight inspection, streamed install output, cancel, and
  rollback. A boot page names the failing plugin and its reason instead of
  rendering blank. An inspector exposes both runtimes to Chrome DevTools.
- **Docs are layered.** Basics, Framework, Practice, then a seven-lesson Cordis
  tutorial, each page one task, in two languages, with generated reference.

Where it is weaker than Fathom:

- **Typing by global mutation.** Services, events, slots, locale keys, and RPC
  errors are typed through declaration merging on framework interfaces. A plugin
  must side-import every merge it uses (`import type {} from '…/client'`); a
  settings plugin opens with six of these before any code. Two plugins that pick
  the same key collide silently at the type level.
- **RPC needs a generator.** Types cross the wire through a codegen step, not a
  schema both sides validate at runtime.
- **Missing dependencies can be silent on the host.** A plugin with an
  unsatisfiable `inject` sits in `PENDING` "indefinitely without error
  messages"; the docs tell you to iterate fiber states to find out why. The
  browser boot page is better and does name the cause.
- **Composition is a YAML patch stack.** Bundle patches, profile patch, home
  patch, argv patches, layered by row id, with `!!js` expressions. Powerful, and
  the first thing a new author gets wrong.
- **No scaffolder.** The documented path is to create the files by hand.

## Fathom, measured

What holds up:

- `requires` and `provides` are typed locally. `use.storage` is inferred from the
  token, with no declaration merging and no global namespace. This is the right
  foundation and DeepSeek does not have it.
- Cross-process APIs are schema-checked at definition, at the server, and at the
  client. Events are typed. Withdrawing an API blocks its UI consumers and
  restoring it starts them again.
- Missing dependencies are diagnosable: a plugin reports `blocked` with
  `waitingOn` listing the token ids.
- Lifecycle is stronger than Cordis: leases hold shutdown open for admitted work,
  failed activation rolls back, config is validated before the old instance stops,
  and `handoff` survives reload.
- The frontend slot model is equivalent in kind: `single`, `keyed`, and `list`
  outlets, error boundaries, and a recovery surface that survives removing every
  UI plugin. DeepSeek has the same model with far more built on it.
- Token identity is the string id, so a second SDK copy still composes.

Where DeepSeek is simply ahead, and Fathom must catch up:

- Installing a plugin from anywhere but a local path, with feedback and rollback.
- A startup diagnostics page that names the failing plugin and why.
- A config page per plugin, driven by its schema.
- Generated reference documentation that cannot drift from the code.
- Runtime inspection of both sides from one DevTools session.

What fails the principles:

| Failure | Principle | Evidence |
| --- | --- | --- |
| Vocabulary is heavy | Small, names | An author meets token, service, registry, lease, scope, defer, task, handoff, slot, contribution, outlet mode, composition, artifact before writing a settings page. |
| Contracts are verbose | Hero scenario | The LLM contract imports eleven TypeBox type names and annotates every schema as `TObject<{…}>` so JSR fast-check passes. That is the file a plugin author copies first. |
| No scaffold, no watch | Zero to success | Adding a plugin is `plugin:add`, restart, `build:ui` after every UI edit, then click Reload. There is no `new`, no file watcher, no single dev command. |
| Manifest duplicates | Hard to misuse | `fathom.sdk: "^0.1"` repeats the version in `imports`. Two places to get wrong. |
| Config has no surface | Progressive disclosure | `definePlugin` accepts a `config` schema, but the guide never shows one, and the plugin manager's Configure action is a raw JSON textarea, not a form generated from it. |
| Composition is hand-edited | Zero to success | Selecting a shell or sidebar means editing `slots.selected` in a JSON file with the host stopped. |
| One long page | Docs are the product | `plugin-authoring.md` mixes formatter settings, lint rules, SDK concepts, control tables, and composition JSON in one file with no quickstart. |
| `use` is an odd word | Names | `start({ use })` then `use.api.serve(…)`. Every other framework calls this `ctx`. |
| Build toolchain in the SDK | Ship separately | `@fathom/sdk/build` drags esbuild, Babel, PostCSS, and Tailwind into the package plugin authors install. |

## Decisions

### 1. The hero plugin defines the SDK

Write this file first, and change the SDK until it type-checks and runs. A
settings page that reads and increments a counter through a typed backend API:

```ts
// plugins/counter/contract.ts
import { defineApi, T, query, command, event } from "@fathom/sdk";

export const CounterApi = defineApi("counter", {
  read: query({ input: T.Object({}), output: T.Object({ count: T.Number() }) }),
  increment: command({ input: T.Object({}), output: T.Object({}) }),
  changed: event(T.Object({ count: T.Number() })),
});
```

```ts
// plugins/counter/backend/mod.ts
import { Api, definePlugin, Storage } from "@fathom/sdk";
import { CounterApi } from "../contract.ts";

export default definePlugin({
  id: "counter",
  requires: { api: Api, storage: Storage },
  start({ api, storage }) {
    const publication = api.serve(CounterApi, {
      read: () => ({ count: Number(storage.get("count") ?? 0) }),
      increment: () => {
        const count = Number(storage.get("count") ?? 0) + 1;
        storage.set("count", count);
        publication.emit("changed", { count });
        return {};
      },
    });
  },
});
```

```tsx
// plugins/counter/ui/mod.tsx
import { definePlugin } from "@fathom/sdk";
import { SettingsSections } from "@fathom/sdk/ui";
import { CounterApi } from "../contract.ts";
import { CounterSettings } from "./CounterSettings.tsx";

export default definePlugin({
  id: "counter",
  requires: { counter: CounterApi, settings: SettingsSections },
  start({ counter, settings }) {
    settings.add(
      { label: "Counter", icon: "plus", component: () => <CounterSettings api={counter} /> },
      { id: "counter", order: 50 },
    );
  },
});
```

Three files, three imports each, no type annotations on schemas, dependencies
destructured by name. Everything below serves this.

### 2. Kill the schema annotation tax

The `TObject<{…}>` annotations exist because JSR's fast-check refuses inferred
export types. Plugin authors who never publish do not need them, and the guide
must stop showing them. For the SDK's own published contracts, keep the
annotations but move them out of the author's sight. Evaluate, in one spike,
whether the SDK should accept any Standard Schema validator (Zod, ArkType,
TypeBox) so authors bring the library they already know. Decide on the spike's
result; do not decide by preference.

### 3. Destructure dependencies

`start({ use, scope })` becomes `start({ api, storage, scope, handoff })`.
Dependencies are spread into the context under their `requires` keys.
`scope` and `handoff` are reserved names and `definePlugin` rejects them as
dependency keys at the type level. Owned registries arrive the same way.

### 4. One dev command, one scaffold, one install

- `deno task new counter` scaffolds `plugins/counter` with the three hero files
  and a `deno.json`, then prints the next command.
- `deno task dev` builds, launches the window, watches plugin sources, rebuilds
  the UI artifact for the changed plugin, and submits a reload for that plugin.
  Backend edits reload the same way. No manual `build:ui`, no clicking Reload.
- `deno task plugin:add <dir>` stays for now. Installing from a JSR name or a
  git address, with streamed output and rollback, is the plugin manager's next
  plan, not this one; the manifest and loader must not preclude it.

### 5. Manifest states one thing

Remove `fathom.sdk`. The SDK version is the import in `imports`. The manifest
keeps `id`, `backend`, `ui`, and gains an optional `config` file reference only
if the spike in decision 6 needs it.

### 6. Config gets a surface

`definePlugin({ config })` already validates. The plugin manager's Configure
action renders a form from the schema for the flat cases (string, number,
boolean, enum, optional) and a JSON editor for the rest. The guide shows
`config` in the second example, not never.

### 7. Startup says what went wrong

The renderer's recovery panel already survives every plugin. It gains a startup
view: each plugin's state, and for `blocked` or `failed`, the missing token ids
or the error, in the first paint, before any shell loads. This is the boot page
DeepSeek ships, on top of diagnostics the kernel already records.

### 7b. Composition gets a surface

Selecting a shell, sidebar, or hiding a contribution is done in Settings →
Plugins, through the existing revision-checked composition API. The JSON file
remains the storage, not the interface.

### 8. Docs, restructured

```text
docs/
  quickstart.md          five minutes: new, dev, see the page, edit, see it reload
  concepts.md            plugin, contract, service, registry, slot; one paragraph each
  guides/
    settings-page.md     the hero plugin, explained
    backend-api.md       defineApi, serve, client, events
    provide-a-service.md replace storage with your own
    replace-the-shell.md AppShell contribution and selection
    publish-a-contract.md JSR exports, fast-check annotations, versioning
  reference/
    sdk.md               every export, one line each, generated from JSDoc; a check fails when stale
    controls.md          the control table, moved out of the guide
    manifest.md          deno.json fathom block
    plugins.md           every bundled plugin's config schema and required tokens, generated
  architecture.md        already written
```

`plugin-authoring.md` is split into these and deleted. Formatter and lint
settings move to `docs/standards/`.

### 9. Vocabulary trimmed

Keep: plugin, contract, service, registry, slot, scope. Retire from the author's
path: token (say "contract"), contribution (say "entry"), outlet mode (the shell
author's concern only), artifact (build output, never in a guide), handoff and
lease (advanced guide only).

## What stays

The kernel model, the typed local `requires` and `provides`, schema-checked APIs,
leases and rollback, slot outlets with recovery, and string-id token identity.
These are the parts that are better than the comparison, and none of the
decisions above touch them.

## Order

1. Decision 3 and the hero plugin (decision 1), since every guide is written
   against them.
2. Decision 2 spike, one day, then the guide examples.
3. Decision 4, the dev loop, since every later check depends on it.
4. Decisions 5, 6, 7, 7b.
5. Decision 8 docs, written against the finished hero plugin.

## Status

Implemented: decisions 1, 3, 4, 5, 6, 7, 8, and 9. The hero plugin is
`examples/counter`; `start` destructures dependencies; `deno task new`
scaffolds; `deno task dev` rebuilds and reloads the edited plugin's half and
was verified live for both halves; the manifest lost `fathom.sdk`; the plugin
manager renders a form from the config schema; the recovery panel lists every
plugin's state with its blocking tokens or error; the docs are split into
quickstart, concepts, guides, and reference, with the SDK and plugin reference
generated by `deno task docs` and checked by `mise run check`.

Decision 2 resolved without a Standard Schema change: plugin contracts drop
their annotations because the `no-slow-types` rule now applies to the SDK
alone. TypeBox stays; it is the one validator that runs identically on both
sides of the wire and supplies defaults.

Remaining: decision 7b, a settings surface for slot composition (the JSON file
and the revision-checked API remain the way to select a shell or sidebar).
