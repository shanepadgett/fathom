# Fathom Baseline

Decisions are firm. Code shapes are sketches, filled in as we build.
Scope `@fathom` is a placeholder until the JSR scope is claimed.

## Layout

```text
.agents/
  fathom/
    plugins/              project-local plugins (trust-gated)
deno.json                 workspace root: members, catalog, tasks
apps/
  desktop/                deno desktop entry (Deno.serve + window)
  ui/                     Solid app; build output served by desktop
packages/
  sdk/                    @fathom/sdk — plugin contract + discovery
  ai/                     @fathom/ai — services, transport, protocols, auth engines
  ai-anthropic/           provider config: route, auth constants, models
  ai-openai/
  ai-xai/
docs/
  plans/baseline.md       this file
```

Global plugins live in `$FATHOM_HOME/plugins`, defaulting to `~/.agents/fathom/plugins`.

Root `deno.json`:

```json
{
  "workspace": ["apps/*", "packages/*"],
  "catalog": { "solid-js": "^1.9.15", "vite": "^8.2.2" },
  "tasks": {
    "dev": "deno run -A apps/desktop/main.ts",
    "desktop": "deno desktop --allow-net --allow-read --allow-write --allow-run apps/desktop/main.ts"
  }
}
```

Member `deno.json`:

```json
{
  "name": "@fathom/ai",
  "version": "0.0.1",
  "exports": { ".": "./src/index.ts" },
  "imports": {
    "cordis": "npm:cordis@4.0.0-rc.9",
    "solid-js": "catalog:"
  }
}
```

## Composition

Every capability is a plugin, including the built-ins. One context, one entry
list, mounted through cordis.

```ts
// apps/desktop/entries.ts
export default [
  defineEntry(ai, { id: "ai", config: { authPath: join(appHome(), "auth.json") } }),
  defineEntry(anthropic, { id: "anthropic" }),
  defineEntry(openai, { id: "openai" }),
  defineEntry(xai, { id: "xai" }),
  defineEntry(scan, { id: "plugins", config: { dirs: [projectDir, globalDir] } }),
  defineEntry(desktop, { id: "desktop" }),
] satisfies Entry[];

// apps/desktop/main.ts
const ctx = await boot(entries);
```

Author-facing contract:

```ts
// packages/sdk/src/index.ts
import type { Context, Disposable } from "cordis";

/** Named services. Each service package merges its own key in. */
export interface Services {}

export type PluginContext<I extends keyof Services> = Context & Pick<Services, I>;

export function definePlugin<
  const I extends readonly (keyof Services)[] = [],
  C = void,
>(spec: {
  name: string;
  inject?: I;
  apply: (ctx: PluginContext<I[number]>, config: C) => void | Disposable;
}) {
  return {
    name: spec.name,
    inject: [...(spec.inject ?? [])] as I,
    apply: (ctx: Context, config: C) => spec.apply(ctx as PluginContext<I[number]>, config),
  };
}
```

Entries and boot:

```ts
type ConfigOf<P> = P extends { apply(ctx: any, config: infer C): any } ? C : never;

export interface Entry {
  id: string;
  plugin: Plugin;
  config?: unknown;
}

export function defineEntry<P extends Plugin>(
  plugin: P,
  spec: { id: string; config?: ConfigOf<P> },
): Entry {
  return { id: spec.id, plugin, config: spec.config };
}

export async function boot(entries: readonly Entry[]) {
  const ctx = new Context();
  for (const entry of entries) await ctx.plugin(entry.plugin, entry.config);
  return ctx;
}
```

`defineEntry` keeps the config type of statically imported plugins. An entry from
disk has no static type; its `Config` schema checks it at load. `boot` and the
scanner both mount entries through `ctx.plugin`.

Augmentation travels with the import. A plugin that uses `ctx.auth` or `ctx.llm`
must import the AI package, even type-only:

```ts
import type {} from "@fathom/ai"; // brings in Services["auth"] and Services["llm"]
```

One plugin, two services:

```ts
// packages/ai/src/index.ts
declare module "@fathom/sdk" {
  interface Services {
    auth: AuthService;
    llm: LlmService;
  }
}

export default definePlugin({
  name: "@fathom/ai",
  apply(ctx, config: AiConfig) {
    ctx.plugin(AuthService, { path: config.authPath ?? join(appHome(), "auth.json") });
    ctx.plugin(LlmService);
  },
});
```

Plugin map:

| Plugin                 | Provides                                     | Injects |
| ---------------------- | -------------------------------------------- | ------- |
| `@fathom/ai`           | `ctx.auth` + `ctx.llm`, protocols, transport | –       |
| `@fathom/ai-anthropic` | route `anthropic` + loopback login           | ai      |
| `@fathom/ai-openai`    | route `openai` + loopback login              | ai      |
| `@fathom/ai-xai`       | route `xai` + device login                   | ai      |
| `@fathom/desktop`      | `Deno.serve` + window + assets               | –       |

Next members: sessions and agent, each its own service. Tools and UI panels
follow.

Extension points instead of branches:

```ts
// retry, logging, routing attach here without touching any provider
ctx.on("llm/stream", function (options, next) { … });

// login UI is a subscriber
ctx.on("auth/notice", ({ providerId, message, url, code }) => { … });
```

## AI services

One package, two services. `ctx.auth` and `ctx.llm` stay separate services because
they have different consumers and lifecycles. They ship in one package because an
author who touches one almost always needs the other.

We own the provider layer. No vendor SDKs and no third-party provider library:
`@fathom/ai` holds the transport and the engines, and each provider is small data
on top of them.

```text
packages/ai/src/
  transport/
    sse.ts          one SSE reader for every provider
    http.ts         fetch, abort, retry, error mapping
  protocols/
    anthropic-messages.ts
    openai-chat.ts
    openai-responses.ts
  auth/
    pkce-loopback.ts   parameterized loopback login
    device-code.ts     parameterized device login
```

A protocol is a request builder and a stream reducer:

```ts
export interface Protocol {
  buildRequest(options: GenerateOptions, provider: ProviderConfig): Request;
  reduceStream(events: AsyncIterable<SseEvent>): AsyncIterable<StreamChunk>;
}
```

`LlmService` owns `registerAdapter` and `stream`. A provider wires shared engines
to its own constants:

```ts
// packages/ai-xai/src/index.ts
export default definePlugin({
  name: "@fathom/ai-xai",
  inject: ["llm", "auth"] as const,
  apply(ctx) {
    ctx.llm.registerAdapter(["xai"], openAiChat({
      baseUrl: "https://api.x.ai/v1",
      apiKeyEnv: "XAI_API_KEY",
      models: XAI_MODELS,
    }));
    ctx.auth.registerFlow(deviceCode({
      providerId: "xai",
      label: "Grok",
      deviceUrl: "https://auth.x.ai/oauth2/device/code",
      tokenUrl: "https://auth.x.ai/oauth2/token",
      clientId: "…",
      scopes: "openid profile email offline_access grok-cli:access api:access",
    }));
  },
});
```

Anthropic and OpenAI use `pkceLoopback` with the same shape.

Auth file: `$FATHOM_HOME/auth.json`, default `~/.agents/fathom/auth.json`. One
code path on every OS, easy to find in support. OS data dirs, keychain, multiple
accounts, and per-workspace credentials are later work. Sharing another app's
auth file is rejected so two apps never write one token file.

```ts
// packages/ai/src/auth/home.ts
import { homedir } from "node:os";
import { join } from "@std/path";

export function appHome(): string {
  return Deno.env.get("FATHOM_HOME") ?? join(homedir(), ".agents", "fathom");
}
```

File shape: one credential per provider, keyed by provider id.

```json
{
  "anthropic": { "type": "oauth", "access": "…", "refresh": "…", "expires": 1758400000000 },
  "openai":    { "type": "api_key", "key": "sk-…" },
  "xai":       { "type": "oauth", "access": "…", "refresh": "…", "expires": 1758400000000 }
}
```

Write path: serialized in-process queue, temp file + rename, mode `0600`.
Cross-process locking can wait; this app is one process.

```ts
// packages/ai/src/auth/store.ts — shape
export class AuthStore {
  #tail: Promise<unknown> = Promise.resolve();

  modify(id: string, fn: (cur?: Credential) => Promise<Credential | undefined>) {
    const run = this.#tail.then(async () => {
      const data = await this.#load();
      const next = await fn(data[id]);
      if (next) data[id] = next;
      await this.#save(data);
      return next;
    });
    this.#tail = run.catch(() => {});
    return run;
  }

  async #save(data: Record<string, Credential>) {
    await Deno.mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.tmp`;
    await Deno.writeTextFile(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
    await Deno.rename(tmp, this.path);
  }
}
```

`AuthService` follows the usual service shape:

```ts
// packages/ai/src/auth/service.ts
export class AuthService extends Service {
  static provide = "auth" as const;

  constructor(ctx: Context, config: { path: string }) {
    super(ctx, AuthService.provide);
  }

  get(id: string): Promise<Credential | undefined> { … }
  modify(id: string, fn: …): Promise<Credential | undefined> { … }
  registerFlow(flow: LoginFlow): Disposable { … }
  login(providerId: string): Promise<Credential> { … } // drives the flow, emits notices + prompts
}
```

The flow machinery, behind `ctx.auth.registerFlow`:

```ts
// packages/ai/src/auth/flow.ts — shapes
export interface LoginFlow {
  providerId: string;
  label: string;
  run(ctx: AuthFlowContext): Promise<Credential>;
}

export interface AuthFlowContext {
  pkce(options: PkceOptions): Promise<Credential>;       // loopback callback server
  deviceCode(options: DeviceCodeOptions): Promise<Credential>; // poll
  notify(notice: { message: string; url?: string; code?: string }): void;
  prompt(question: { message: string; placeholder?: string }): Promise<string>;
}
```

Environment keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …) are read-only
fallbacks resolved at request time. Never written into the file.

Already decided for login: system browser, not an embedded window. The flow emits
`{ message, url?, code? }` notices and prompts; the UI decides how to show them.
The `openExternal` shim is a small per-OS `Deno.Command` table.

## Sessions and HTTP surface

The sessions plugin persists to one sqlite database at `$FATHOM_HOME/sessions.db`
through `node:sqlite`, which Deno ships. One writer, atomic commits, no folder of
files to manage.

The UI talks HTTP, not `bindings`. One loopback hop costs nothing, SSE carries
tokens, and the same UI runs in a browser tab during development.

| Route                             | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `GET /api/sessions`               | list sessions                             |
| `POST /api/sessions`              | create a session                          |
| `GET /api/sessions/:id`           | load a transcript                         |
| `POST /api/sessions/:id/messages` | send; the reply streams as SSE            |
| `POST /api/sessions/:id/cancel`   | stop the active stream                    |
| `GET /api/events`                 | app events: plugin changes, install steps |
| `GET /api/models`                 | available models                          |
| `GET /api/auth`                   | credential status per provider            |
| `POST /api/auth/:provider/login`  | start a login flow                        |

Streaming is a normal response body. The UI reads it with `fetch` and a
`ReadableStream`; cancellation is an `AbortController`. No custom framing.

Browsers allow about six open connections per address. One active stream is the
normal case, and `GET /api/events` holds one slot. If several sessions ever
stream at once, the fix is a shared stream, not a different protocol.

`bindings` stay reserved for native-only actions.

Call graph, one chat turn:

```text
Solid UI
  └─ POST /api/sessions/:id/messages → SSE stream
      └─ desktop plugin route
          └─ ctx.agent.run(input)
              └─ ctx.llm.stream(options)
                  ├─ ctx.auth.get(providerId)   # refresh if expired, serialized
                  └─ protocol adapter → provider SSE → StreamChunk
                      └─ ctx.sessions.append(chunks) → UI
```

## Plugin discovery and reload

Sources, in load order:

1. `.agents/fathom/plugins/` — project-local, trust-gated
2. `$FATHOM_HOME/plugins/` — global, default `~/.agents/fathom/plugins`
3. installed packages — JSR first, npm later

Discovery rules, one level, no recursion:

- a direct `*.ts` file is one plugin
- a subdirectory with `index.ts` is one plugin
- a subdirectory with a `fathom` manifest lists plugins

Ids are short and unique across the whole composition (`ai`, `anthropic`, `plugins`).
A duplicate is a boot error that names both files.

Package manifest, in `deno.json`:

```json
{
  "name": "@acme/fathom-tools",
  "version": "0.1.0",
  "exports": "./mod.ts",
  "fathom": {
    "plugins": ["./plugins/a.ts", "./plugins/b/"]
  }
}
```

The reader checks `deno.json`, then `deno.jsonc`, then `package.json`. `name`,
`version`, and `exports` are only required for a package imported by specifier or
published. Deno ignores the `fathom` key; the runtime and checker accept it. JSR
publish behavior for the extra key is untested.

The scanner is an entry, not a boot step. It contributes entries from disk to the
same loader the built-ins pass through.

```ts
// packages/sdk/src/discover/scan.ts
export default definePlugin({
  name: "@fathom/sdk/scan",
  apply(ctx, config: ScanConfig) {
    for (const dir of config.dirs) {
      mountEntries(ctx, discoverDir(dir, config.trusted));
    }
  },
});
```

`mountEntries` is the `ctx.plugin` loop that `boot` uses for the built-in list.

Project plugins load only after the project is trusted. The first time one is
found, the app asks; nothing loads before an answer. "Always trust" writes the
path into global settings.

```json
// $FATHOM_HOME/settings.json
{ "trustedProjects": ["/Users/me/dev/my-repo"] }
```

Reload is per plugin, not per app. A plugin is a fiber: unload disposes what it
registered, then the module re-imports.

```ts
// packages/sdk/src/discover/watch.ts — shape
for await (const event of Deno.watchFs([projectDir, globalDir])) {
  for (const path of pluginEntriesFor(event.paths)) {
    await ctx.reloadPlugin(path); // unload fiber, import(`${path}?v=${Date.now()}`), ctx.plugin
  }
}
```

Load order does not matter: cordis `inject` holds each plugin until its services
exist. The UI learns through one event.

```ts
ctx.on("plugins/changed", ({ action, id }) => { … }); // "added" | "changed" | "removed"
```

## Permissions and packaging

Deno flags, baked into the desktop build:

| Flag             | Grants                          | Scope example                                            |
| ---------------- | ------------------------------- | -------------------------------------------------------- |
| `--allow-read`   | plugin dirs, `$FATHOM_HOME`     | `--allow-read="$HOME/.agents/fathom,./.agents/fathom"`   |
| `--allow-write`  | auth.json, plugin installs      | `--allow-write="$HOME/.agents/fathom"`                   |
| `--allow-net`    | provider HTTP                   | `--allow-net="api.anthropic.com:443,api.openai.com:443"` |
| `--allow-import` | remote plugin imports           | default host list covers jsr.io                          |
| `--allow-run`    | browser opener, plugin commands | `--allow-run`                                            |

`--include` is a build-time packing flag, not a permission. It embeds code that
only a dynamic `import()` reaches: `--include ./plugins` for bundled plugins,
`npm:pkg` for dynamically imported npm packages. A plugin fetched at runtime
instead needs `--allow-import` and `--allow-net`; one under `$FATHOM_HOME` needs
`--allow-read`.

Plugins run with the app's permissions. The trust gate is the only wall, so it
stays in front of project plugins.

## Plugin type safety

Three layers: cordis types the runtime contract, the SDK tightens it, the host
verifies what types cannot reach.

What cordis already enforces (4.0.0-rc.9):

- `ctx.plugin(P, config)` checks `config` against the plugin shape (`GetPluginConfig`).
- `Plugin.Base.Config` takes a standard schema and validates config before start.
- `inject` holds the plugin until its services exist.
- an apply return value is collected as a `Disposable`.

What the SDK adds: `ctx` sees exactly the services named in `inject`. Using a
service you did not inject is a compile error.

```ts
// packages/ai-anthropic/src/index.ts
export default definePlugin({
  name: "@fathom/ai-anthropic",
  inject: ["llm", "auth"] as const,
  apply(ctx, config: Config) {
    // ctx has llm + auth, nothing else
  },
});
```

Config: one declaration gives the static type and the runtime check.

```ts
export const Config = z.object({
  apiKeyEnv: z.string().default("ANTHROPIC_API_KEY"),
  streamIdleTimeoutMs: z.number().default(300_000),
});
export type Config = z.infer<typeof Config>;
```

Events: the package that owns an event augments `Events`.

```ts
declare module "cordis" {
  interface Events {
    "llm/stream"(
      this: LlmService,
      options: GenerateOptions,
      next: () => AsyncIterable<StreamChunk>,
    ): AsyncIterable<StreamChunk>;
  }
}
```

Known gaps:

| Gap                                          | Fix                                                    |
| -------------------------------------------- | ------------------------------------------------------ |
| `static provide` vs `super(ctx, name)` drift | one value: `super(ctx, AuthService.provide)`           |
| using a service you did not inject           | `PluginContext<I[number]>` hides uninjected keys       |
| config from files is untyped                 | export a `Config` schema; validation runs before start |
| dynamic JSR plugin: compiler cannot see it   | runtime gate at load                                   |
| event name typos                             | augment `Events`; `ctx.on` checks the name             |
| two plugins provide one service              | cordis throws on the second registration               |

Third-party plugins are the honest limit. The compiler cannot see a module
fetched at runtime, so the host checks shape and names:

```ts
const mod = await import("jsr:@acme/fathom-tools@0.1");
ctx.plugin(assertPlugin(mod.default), config);
```

```ts
function assertPlugin(value: unknown, known: ReadonlySet<string>) {
  // name: string, apply: function
  // inject ⊆ known
  // sdk range intersects ours
}
```

Failure policy: refuse the mount and show the reason in the plugin list. A
warning-only mount would let a plugin register a wrongly shaped service.

Outside static typing: a plugin can still cast, a runtime plugin's config is
only as good as its own schema, and no entry list has an inject-order check —
ordering is cordis `inject` waiting.
Project trust decides whether a project plugin loads; the shape gate decides
whether it is well formed.

## JSR SDK

Publish the contracts. `@fathom/ai` is the single author-facing AI package: the
contracts plus the engines provider plugins build on.

| Package        | Surface                                                               | Publish          |
| -------------- | --------------------------------------------------------------------- | ---------------- |
| `@fathom/sdk`  | plugin contract: `definePlugin`, `defineEntry`, `Services`            | yes              |
| `@fathom/ai`   | contracts, transport, protocols, auth engines, `ctx.auth` + `ctx.llm` | yes              |
| `@fathom/ai-*` | first-party provider configs                                          | later            |
| `apps/*`       | the app                                                               | `publish: false` |

What it takes:

- Per member: `name`, `version`, `exports`, README, LICENSE, doc comments on every exported type.
- `deno publish --dry-run` in CI; publish each member from its own directory, in dependency order.
- Workspace refs become registry refs automatically on publish.
- `cordis` stays an npm dep (`npm:cordis@4.0.0-rc.9`). JSR allows npm deps.
- Plugin packages declare entries under `fathom` in `deno.json`; the reader falls back to `package.json`.
- Claim the `@fathom` scope on jsr.io.
- One version line: all `@fathom/*` bump together so contract and plugins cannot skew.

What an outside author writes:

```ts
// @acme/fathom-groq/mod.ts
import { definePlugin } from "@fathom/sdk";
import { openAiChat } from "@fathom/ai";

export default definePlugin({
  name: "@acme/fathom-groq",
  inject: ["llm"] as const,
  apply(ctx) {
    ctx.llm.registerAdapter(["groq"], openAiChat({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKeyEnv: "GROQ_API_KEY",
      models: GROQ_MODELS,
    }));
  },
});
```

Loaded host-side:

```ts
ctx.plugin(await import("jsr:@acme/fathom-groq@0.1"));
```

Seams to freeze before the first publish:

- service names in `Services`
- method names: `ctx.llm.registerAdapter`, `ctx.llm.stream`, `ctx.auth.modify`, `ctx.auth.registerFlow`, `ctx.auth.login`
- protocol factories: `anthropicMessages`, `openAiChat`, `openAiResponses`
- auth engines: `pkceLoopback`, `deviceCode`
- event names: `llm/stream`, `auth/notice`, `auth/prompt`
- error type crossing the plugin boundary
- disposer contract: registrations die with the plugin fiber
- plugin config validation: who owns the schema

## Deferred

Each item lands in the shapes above, not as a replacement for them.

- packages installed from JSR first, then npm
- a plugin install UI
- sandboxing of plugin code
- keychain, OS data dirs, multiple accounts, and per-workspace credentials
