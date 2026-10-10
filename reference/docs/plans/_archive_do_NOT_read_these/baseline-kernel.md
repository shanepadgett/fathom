# Fathom Baseline — Small Kernel, Live Plugins

One process. One small kernel we own. Everything else is a plugin that can be
loaded, stopped, configured, and replaced while the app runs.

`@fathom` is a placeholder scope. Code blocks are shapes, not final code.

## The one idea

Deno 2.9 supports `module.registerHooks()` for ES modules, including nested
imports. The kernel installs one `resolve` hook and **no `load` hook**. When a
plugin is (re)loaded, every file inside that plugin's folder is resolved with a
generation tag. Deno reads and transpiles the file as normal; the query string
only makes the module key unique.

```text
file:///…/plugins/anthropic/mod.ts?gen=3
file:///…/plugins/anthropic/models.ts?gen=3   ← nested import, also fresh
jsr:@fathom/ai                                ← shared library, still cached
```

```ts
// packages/kernel/src/loader.ts — the whole hook
registerHooks({
  resolve(spec, ctx, next) {
    const r = next(spec, ctx);
    const dir = pluginDirOf(r.url);                       // which plugin folder, if any
    if (!dir) return r;
    const u = new URL(r.url);
    if (u.searchParams.has("gen")) return r;
    const gen = genFromParent(ctx.parentURL) ?? current(dir);
    u.searchParams.set("gen", String(gen));
    return { url: u.href, shortCircuit: true };
  },
});
```

A fresh generation is a fresh module graph. The old one stays in memory until
the app exits (ES modules cannot be unloaded). Measured on Deno 2.9.7: about
35KB RSS per reload, heap flat. 400 reloads cost 14MB. Accepted.

Do not add a `load` hook. The spike tried one that stripped `?gen` and called
`nextLoad(clean)`. Deno returns `source: null` for that, which made a broken
nested file load stale, and hook-supplied source is not transpiled. The resolve
hook alone has neither problem.

Fallback if a Deno release breaks the hook: copy the plugin folder to
`$FATHOM_HOME/artifacts/<id>/<gen>/` and import from there. The spike proved
this path too. Only `loader.ts` changes; contracts do not.

```text
edit plugins/anthropic/models.ts
  → watcher: plugin "anthropic" changed
  → kernel: import("…/anthropic/mod.ts?gen=3")     new graph, old still serving
  → validate shape + config                        fail → old keeps running
  → stop old (drain, then dispose scope)
  → start new, publish services
  → emit plugins/changed
```

Why not the other options:

| Option | Reason not chosen |
| --- | --- |
| Cordis | Its reload needs loader internals we do not have on Deno. The rest is ~500 lines we can own. |
| Worker per plugin | Every service call becomes async message passing. Isolation is not a baseline need. The kernel API is async, so a worker host can be added later as a plugin host without changing contracts. |
| `deno bundle` artifacts | A build step in the reload path. Hooks give fresh graphs without it. |
| `--watch-hmr` | Falls back to process restart. Not controllable. |

## Layout

```text
deno.json                 workspace, tasks, import map
apps/
  desktop/main.ts         boots the kernel with the built-in list, opens the window
  ui/                     Solid app, served by the http plugin
packages/
  sdk/                    published: definePlugin, defineService, contracts, schemas
  kernel/                 runtime: loader hook, registry, scopes, change queue
  ai/                     library: protocols, SSE, retry, OAuth engines, credential file
  agent/                  library: message types, agent loop function
plugins/                  built-ins; one folder each; same contract as outside plugins
  storage/                sqlite owner (node:sqlite)
  sessions/               session + run records
  credentials/            auth file, login flows, env fallback
  llm/                    provider registry + stream()
  provider-anthropic/     protocol config + login constants
  provider-openai/
  provider-xai/
  tools/                  tool registry + guarded execution
  tools-coding/           read, write, edit, bash, grep, glob
  agent/                  runs the loop, owns runs
  http/                   Deno.serve, routes, SSE, static UI
  desktop/                window
  plugin-manager/         discovery, trust, watch, enable/disable, install
```

Rules that keep reload boundaries clean:

- `packages/*` never import `plugins/*` or the kernel. They are plain functions.
- A plugin never imports another plugin. It uses a service or a shared package.
- A plugin folder is self-contained. Imports leave the folder only as bare
  specifiers (`@fathom/ai`, `jsr:`, `npm:`).

```text
plugins/*  →  packages/sdk  ←  packages/kernel
plugins/*  →  packages/ai, packages/agent
```

## Plugin contract

```ts
// plugins/sessions/mod.ts
import { definePlugin } from "@fathom/sdk";
import { Storage, Sessions } from "@fathom/sdk/services";

export default definePlugin({
  id: "sessions",
  config: Type.Object({ retentionDays: Type.Number({ default: 90 }) }),
  requires: { storage: Storage },
  provides: { sessions: Sessions },

  async start({ use, scope }, config) {
    const sessions = createSessions(use.storage, config);   // library function
    scope.defer(() => sessions.close());
    return { sessions };
  },
});
```

- `use` has only what `requires` names. Anything else is a type error.
- `start` returns exactly what `provides` names.
- `config` is a TypeBox schema. One declaration gives the type and the check.
  TypeBox is the one schema library: plugin config, service arguments, and
  tool parameters all use it, and tool schemas go to the model as the same
  JSON Schema object with no conversion.
- Module top level only declares. Resources start in `start`, die with `scope`.

A service token is a name plus a type:

```ts
// packages/sdk/src/services/sessions.ts
export const Sessions = defineService<SessionsApi>("sessions");
```

Contribution is a registration that returns a disposer. The scope collects it:

```ts
// plugins/provider-anthropic/mod.ts
export default definePlugin({
  id: "anthropic",
  requires: { llm: Llm, credentials: Credentials },
  start({ use, scope }) {
    scope.defer(use.llm.register(anthropicProvider()));
    scope.defer(use.credentials.registerLogin(anthropicLogin()));
  },
});
```

Two kinds of dependency, two reload behaviours:

| Kind | Example | On reload of the target |
| --- | --- | --- |
| `requires` a service | sessions → storage | consumers stop first, restart after |
| registers into a service | anthropic → llm | only this plugin restarts; registry drops its entries |

Scope owns every effect:

```ts
scope.defer(dispose)                 // reverse order on stop
scope.task((signal) => watch(signal)) // aborted then awaited on stop
scope.signal                         // aborts on stop; pass into fetch, sqlite, commands
```

## Kernel

```text
packages/kernel/src/
  loader.ts     registerHooks resolve: tag plugin-folder URLs with ?gen=N
  registry.ts   plugins, services, generations, actual state
  scope.ts      defer / task / signal, ordered disposal
  changes.ts    one queue; enable, disable, configure, reload, install
  boot.ts       boot(entries) → Kernel
```

State is two lists, desired and actual, never merged:

```ts
interface PluginStatus {
  id: string;
  desired: { enabled: boolean; source: string; config: unknown };
  actual:  { state: "stopped" | "blocked" | "starting" | "ready" | "stopping" | "failed";
             gen?: number; error?: string };
}
```

Every change goes through one queue and one sequence:

```ts
await changes.run(async () => {
  const mod = await load(source, nextGen);          // fresh graph, old still serving
  const plugin = assertPlugin(mod.default);         // shape, id, requires ⊆ known
  const config = plugin.config.parse(desired.config);
  const affected = [id, ...transitiveRequirers(id)];

  await stop(affected, { drainMs: 10_000 });        // consumers first
  try {
    await start(affected, plugin, config);          // providers first
  } catch (e) {
    await start(affected, previous.plugin, previous.config);  // old module still in memory
    mark(id, "failed", e);
  }
  emit("plugins/changed", { id, affected });
});
```

Rollback is cheap because the previous module namespace is still loaded. We keep
the last good `{ plugin, config }` per id.

Drain: `stop` flips the plugin to `stopping`, new root work is refused, active
tasks get `drainMs` to finish, then `scope.signal` aborts them. The UI shows what
is waiting and offers "cancel now". A `tool-started` record without a result is
reported as unknown outcome, never rerun.

Boot is the same path with an empty previous state:

```ts
// apps/desktop/main.ts
const kernel = await boot({
  home: appHome(),                       // $FATHOM_HOME, default ~/.agents/fathom
  builtins: import.meta.resolve("../../plugins/"),
  entries: [
    "storage", "sessions", "credentials", "llm",
    "anthropic", "openai", "xai",
    "tools", "tools-coding", "agent", "http", "desktop", "plugin-manager",
  ],
});
```

`requires` decides order. The list is just membership.

## AI

We own the wire. No vendor SDKs.

```text
packages/ai/src/
  transport/sse.ts              one SSE reader
  transport/http.ts             fetch + abort + retry classes + error mapping
  protocols/anthropic-messages.ts
  protocols/openai-responses.ts
  protocols/openai-chat.ts
  auth/pkce-loopback.ts         system browser + 127.0.0.1 callback
  auth/device-code.ts           show code, poll
  auth/file.ts                  auth.json, 0600, temp+rename, single writer
  messages.ts                   Message, Part, ToolCall, StreamEvent
```

A protocol is two functions. A provider is data on top of a protocol:

```ts
interface Protocol {
  request(opts: StreamOptions, provider: ProviderConfig, cred: Credential): Request;
  events(sse: AsyncIterable<SseEvent>): AsyncIterable<StreamEvent>;
}

// plugins/provider-xai/mod.ts
const xai = provider({
  id: "xai",
  protocol: openAiChat,
  baseUrl: "https://api.x.ai/v1",
  models: XAI_MODELS,
  auth: { env: "XAI_API_KEY", login: deviceCode({ … }) },
  quirks: { … },              // provider differences live here, typed per protocol
});
```

`llm` service:

```ts
interface LlmApi {
  register(p: Provider): () => void;
  models(): ModelInfo[];
  stream(opts: StreamOptions, signal: AbortSignal): AsyncIterable<StreamEvent>;
}
```

`stream` resolves the credential, builds the request, reads SSE, yields
`StreamEvent` (`text`, `reasoning`, `tool-call`, `usage`, `done`, `error`).
Provider-specific metadata rides in `raw` fields so replay keeps it.

`credentials` service:

```ts
interface CredentialsApi {
  get(providerId: string): Promise<Credential | undefined>;   // refresh if expired, single-flight
  status(): Record<string, "none" | "env" | "api_key" | "oauth">;
  registerLogin(flow: LoginFlow): () => void;
  login(providerId: string, ui: LoginUi): Promise<void>;      // ui = { notify, prompt }
}
```

Login has no UI of its own. It emits `{ message, url?, code? }` and asks
`prompt()` when it needs a value. The HTTP plugin exposes that over SSE; the
Solid UI renders it. Secrets never enter session records or logs; the stream
layer redacts `Authorization` in every error.

## Agent, tools, sessions

The loop is a plain function in `packages/agent`. The `agent` plugin wires it.

```ts
export async function* runAgent(input: RunInput, deps: Deps, signal: AbortSignal) {
  for (let step = 0; step < input.maxSteps; step++) {
    signal.throwIfAborted();
    const messages = await deps.sessions.history(input.sessionId);
    const reply = yield* collect(deps.llm.stream({ model: input.model, messages, tools: deps.tools.schemas() }, signal));
    await deps.sessions.append(input.sessionId, assistant(reply));
    if (reply.stop !== "tool-calls") return reply.stop;
    for (const call of reply.toolCalls) {
      await deps.sessions.append(input.sessionId, toolStarted(call));
      const result = await deps.tools.execute(call, { signal, approve: deps.approve });
      await deps.sessions.append(input.sessionId, toolResult(call, result));
    }
  }
  return "max-steps";
}
```

`deps` is captured once per run. A reload of a registered provider or tool does
not swap under a running step; a reload of `llm` or `sessions` stops `agent`
(it `requires` them) and drains runs first.

Tools:

```ts
interface ToolsApi {
  register(tool: Tool): () => void;
  schemas(): ToolSchema[];
  execute(call: ToolCall, ctx: { signal: AbortSignal; approve: Approve }): Promise<ToolResult>;
}
```

`execute` parses arguments against the tool schema, asks `approve` for tools
marked `dangerous`, runs once, returns. Coding tools take a `cwd` and use
`Deno.Command` with the run's `signal`.

Sessions in one sqlite file, `$FATHOM_HOME/fathom.db`, owned by `storage`:

```text
sessions  id, cwd, title, created_at
runs      id, session_id, status, created_at
records   session_id, seq, run_id, kind, payload_json
```

Append-only records. Model history is derived from records. One active run per
session. Cancel is `AbortController.abort()` on that run.

## HTTP and UI

`http` owns `Deno.serve` on `127.0.0.1`, a random port, and a per-launch bearer
token. Plugins register routes; replacing a route plugin does not rebind.

```ts
interface HttpApi {
  route(method: string, path: string, handler: Handler): () => void;
  static(prefix: string, dir: string): () => void;
  broadcast(event: AppEvent): void;          // fan-out to GET /api/events
}
```

```text
GET  /api/events                    SSE: plugin changes, run progress, login notices
GET  /api/sessions                  list
POST /api/sessions                  create
GET  /api/sessions/:id              records since ?seq
POST /api/sessions/:id/runs         start a run; progress arrives on /api/events
POST /api/runs/:id/cancel
POST /api/runs/:id/approve
GET  /api/models
GET  /api/auth                      status
POST /api/auth/:provider/login
POST /api/auth/:provider/prompt     answer a login prompt
GET  /api/plugins                   status list
POST /api/plugins/:id/{enable,disable,reload,config}
```

One SSE connection carries everything; the UI reconnects with `?since=seq`.

The desktop plugin opens a native webview on the http URL. The exact webview
binding is chosen in the first spike, not here. The same UI runs in a browser tab
in dev.

UI plugins: a backend plugin can register a UI bundle
(`use.http.static("/plugins/foo", dir)` plus a `ui` entry in its manifest). The
Solid shell loads it with `import(url + "?gen=N")` and unmounts the old one on
`plugins/changed`. Same generation idea, browser side.

## Discovery, trust, install

```text
built-ins        plugins/ inside the app
global           $FATHOM_HOME/plugins/<id>/mod.ts
project          <cwd>/.agents/fathom/plugins/<id>/mod.ts     trust prompt first
installed        $FATHOM_HOME/installed/<name>@<version>/     jsr first
```

Discovery reads folder names and `manifest.json`; it never imports code. Id
collisions are an error naming both paths. Project plugins wait on a trust
answer; "always" writes the path into `$FATHOM_HOME/settings.json`.

```text
$FATHOM_HOME/
  composition.json    desired: enabled, source, config per id
  auth.json           credentials, 0600
  fathom.db           sessions
  settings.json       trusted projects
  plugins/  installed/
```

Install is `deno add`-style download into `installed/`, then a normal enable.

Plugins run with the app's permissions. Trust is the wall. A worker or a schema
check is not a sandbox and we do not claim one.

## Type safety

| Layer | Checks |
| --- | --- |
| TypeScript | `use` keys, `start` return shape, config type, service method types |
| `assertPlugin` at load | `id`, `start` is a function, `requires` names known services, sdk version range |
| schema at load | plugin config from disk |
| kernel at start | one provider per service, no cycles, all requires present or `blocked` |

A plugin that fails any check is `failed` with the reason in `/api/plugins`. It
never half-starts.

## Call graph, one turn

```text
Solid UI  POST /api/sessions/:id/runs
  └─ http route (agent plugin)
      └─ agent.startRun(input)                       captures deps once
          └─ runAgent(input, deps, signal)
              ├─ sessions.history / append           → storage (sqlite)
              ├─ llm.stream
              │    ├─ credentials.get(provider)       refresh if needed
              │    └─ protocol.request → fetch → sse → protocol.events
              └─ tools.execute → approve? → tool.run
          └─ http.broadcast(progress)                 → GET /api/events → UI
```

## Spike results

Done on Deno 2.9.7 (`docs/plans/kernel-spike-report.md` plus a resolve-only
re-test). A ~280 line kernel was enough.

| Check | Result |
| --- | --- |
| nested import gets fresh graph, old graph still serves | pass |
| broken nested file: import throws, old generation intact | pass (resolve-only) |
| caller restarted when greeter reloads; shared lib stays cached | pass |
| bad candidate: validated before stop, old keeps running | pass |
| disable → consumer `blocked`; enable → `ready` | pass |
| active stream aborted on `scope.signal`, then swapped | pass |
| `node:sqlite` open/close inside a scope | pass |
| 400 reloads | pass, ~35KB RSS each, heap flat |

Still to prove, in order, before the harness grows:

```text
watcher → debounce → reload, with atomic-save renames (Deno.watchFs)
plugin that imports jsr:/npm: inside its folder; hook must leave those alone
two plugins reloaded in one change (shared `requires` cascade), no double start
drain: run refuses new root work but finishes the current tool call
reload while a run is mid-stream: run settles as "interrupted", never rerun
config-only change: same path as code reload, no half-applied config
hook cost: resolve time for a cold app boot with and without the hook
```

## Deferred

- Worker plugin host, sandboxing, per-plugin permissions
- npm install source, marketplace, auto-update
- Keychain, multiple accounts, per-project credentials
- Parallel tools, subagents, session branching, compaction
- Publishing `@fathom/sdk`, `@fathom/ai`, `@fathom/agent` to JSR (after the spike and one outside plugin work)
