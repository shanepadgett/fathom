# Fathom Baseline v2 — Kernel, UI Host, One Public SDK

Status: proposed implementation plan. This is a new plan; it does not replace or
modify `baseline-kernel.md`. `@fathom` is a placeholder scope. Code below describes
contracts and execution order, not finished implementations.

## 1. Baseline decisions

| Concern | Decision |
| --- | --- |
| Backend | One Deno process, a small kernel, live backend plugins |
| Frontend | Solid renderer, a small UI host, live UI plugins |
| Desktop | Native window hosting the same UI used in browser development |
| Author dependency | One published package: `@fathom/sdk` |
| UI exports | Everything frontend-related lives under `@fathom/sdk/ui` |
| Built-ins | Ordinary plugins using public SDK exports |
| Extension model | Typed services on the backend; typed slots and host APIs on the frontend |
| Transport | Typed HTTP commands/queries, one authenticated SSE connection |
| Schemas | TypeBox at runtime boundaries; inferred TypeScript types |
| Styling | Shared tokens, reusable components, supported Tailwind setup |
| Trust | Plugins have the privileges of their host; no sandbox claim |

"One process" means one backend process. The desktop binding may use separate
renderer/native processes. Backend module hooks do not run in the browser.

```text
                         ONE PUBLIC AUTHOR SURFACE
                              @fathom/sdk
                             /          \
                    backend APIs       /ui APIs
                        ↑                  ↑
                backend plugins        UI plugins
                        ↑                  ↑
                    kernel             UI host
                        \                 /
                         HTTP + SSE bridge

                 built-in plugins = external plugins
                 same imports, registration, lifecycle
```

The host owns bootstrapping, dependency management, transport connections,
composition, and recovery. Features use those capabilities through the SDK.

## 2. Repository and publication

```text
deno.json                         workspace, import map, tasks
apps/
  desktop/main.ts                 boot backend, connect native window lifecycle
  ui/main.tsx                     boot UI host, mount root, connect transport

packages/
  sdk/                            ONLY package published to JSR
    deno.json                     explicit public exports
    src/
      mod.ts                      definePlugin, defineService, manifest helpers
      schema.ts                   supported TypeBox exports/helpers
      scope.ts                    public scope interfaces
      services/                   built-in service tokens + interfaces
      api/                        serializable endpoint/event contracts
      ai/                         protocol and provider utilities
      agent/                      composable agent-loop utilities
      dev/                        init, build, check, development harness
      ui/
        mod.ts                    defineUiPlugin, defineSlot, host interfaces
        slots.ts                  built-in typed slot tokens
        client/                   browser-safe typed client
        components/
          primitives/             Button, Dialog, Menu, Tooltip
          conversation/           Message, ToolCall, Conversation
          composer/               Editor, Attachments, ModelPicker, Composer
          navigation/             SessionList and navigation pieces
        hooks/                    composable public UI behavior
        theme/                    tokens, themes, base styles
        tailwind/                 supported build integration

  kernel/                         private runtime implementation
    src/{loader,registry,scope,changes,boot}.ts
  ui-host/                        private runtime implementation
    src/{loader,registry,scope,composition,connection,boot}.ts

plugins/
  storage/                        sqlite owner
  sessions/                       session/run persistence + API handlers
  credentials/                    credential storage + login flows
  llm/                            provider registry + streaming
  provider-anthropic/
  provider-openai/
  provider-xai/
  tools/                          tool registry + guarded execution
  tools-coding/                   read, write, edit, bash, grep, glob
  agent/                          run coordinator + API handlers
  http/                           listener, route/event registries, UI assets
  desktop/                        native window adapter
  plugin-manager/                 discovery, installation, trust, configuration
  workspace-ui/                   default root layout and nested slots
  conversation-ui/                default session content
  composer-ui/                    default composer
  session-list-ui/                default sidebar
  settings-ui/                    settings sections and plugin management UI

fixtures/
  external-plugin/                copied outside workspace for package checks
tests/
  kernel/                         lifecycle and graph integration checks
  ui-host/                        composition and lifecycle integration checks
```

Public import map, not a list of packages to install:

```ts
// Backend author
import { definePlugin, defineService } from "@fathom/sdk";
import { Type } from "@fathom/sdk/schema";
import { Sessions, Llm } from "@fathom/sdk/services";
import { defineApi } from "@fathom/sdk/api";

// UI author
import { defineUiPlugin, defineSlot } from "@fathom/sdk/ui";
import { ComposerSlot } from "@fathom/sdk/ui/slots";
import { Composer, Button } from "@fathom/sdk/ui/components";
import { useSession } from "@fathom/sdk/ui/hooks";
import { createClient } from "@fathom/sdk/ui/client";

// Optional capabilities, still inside the same package
import { openAiChat } from "@fathom/sdk/ai";
import { runAgent } from "@fathom/sdk/agent";
```

| Import boundary | Rule |
| --- | --- |
| SDK → kernel/UI host/plugins | Forbidden |
| Plugin → another plugin's implementation | Forbidden |
| Plugin → kernel/UI host internals | Forbidden |
| Built-in → SDK | Public exports only; no `src/` imports |
| UI entry → backend-only module | Build error |
| Backend entry → UI renderer module | Build error |
| Plugin → independent shared contract/library | Allowed through a bare package specifier |

SDK entry points must have separate dependency graphs. Importing a button must
not pull in Deno APIs, sqlite, the agent loop, or credential storage.

The published SDK contains implementations as well as types. Types, runtime
tokens, schemas, and host compatibility checks describe the same contracts.

### Bootstrap and host-provided services

```ts
// apps/desktop/main.ts — one of the few places importing host internals.
const kernel = await boot({
  home: appHome(),
  builtinRoot: appResourcePath("plugins"),
  composition: await readComposition(),
  platform: createNativePlatformAdapter(),
});
await kernel.untilExit();

// apps/ui/main.tsx
const host = await bootUiHost(await authenticatedBootstrap());
render(() => <host.Root />, document.getElementById("app"));
```

```text
kernel supplies stable, public service contracts
  KernelControl     inspect state, submit changes, observe change results
  AppEnvironment    app home, resource paths, platform information
  NativePlatform    desktop capability adapter (desktop boot only)

backend plugin dependency shape
  storage           → AppEnvironment
  http              → KernelControl, AppEnvironment
  sessions          → storage, http
  credentials       → AppEnvironment, http
  llm               → credentials
  providers         → llm, credentials
  tools             → no mandatory service dependencies
  tools-coding      → tools
  agent             → sessions, llm, tools, http
  desktop           → http, NativePlatform
  plugin-manager    → KernelControl, AppEnvironment, http
```

Service tokens for these capabilities are exported from `@fathom/sdk/services`.
External plugins may declare them through `requires` too. They never import the
kernel to manage plugins or a native binding to access desktop capabilities.

`KernelControl.submit(change)` returns an operation ID once queued. The submitting
request does not await its own reload/disable; completion arrives through status
and events. Reject synchronous lifecycle waits on the currently executing change
to avoid queue deadlocks.

The HTTP plugin exposes a small host recovery API using `KernelControl`, so a
failed plugin-manager UI/backend can still be disabled or restored. The full
management workflow remains a plugin. If HTTP itself restarts, the desktop adapter
reconnects to the newly advertised address; the native bootstrap handles failure
before any renderer is available.

## 3. Author workflow and plugin artifact

One SDK dependency and one generated project. The generated tasks configure the
supported compiler, Solid transform, CSS pipeline, and host-shared imports.
Authors do not assemble those settings manually.

```text
deno run jsr:@fathom/sdk/dev init my-plugin     proposed CLI
cd my-plugin
deno task dev                                build UI, attach to dev app, watch
deno task check                              types, manifest, build boundaries
deno task build                              immutable installable artifact
```

```text
my-plugin/
  deno.json                     one direct Fathom dependency; generated tasks
  manifest.json                 discoverable without executing plugin code
  backend/mod.ts                optional
  ui/mod.tsx                    optional
  ui/styles.css                 optional
  contracts.ts                  optional browser-safe API/slot definitions

artifact/
  manifest.json
  backend/…                     backend source and required files
  ui/<content-hash>/
    entry.js
    chunks/…                    all relative imports stay in this artifact
    styles.css
    assets/…
```

```ts
interface PluginManifest {
  id: string;                   // globally unique, e.g. "acme.better-composer"
  version: string;
  sdk: string;                  // supported SDK version range
  backend?: { entry: string };
  ui?: {
    entry: string;
    styles: string[];
    requiresBackend: boolean;   // false allows a standalone UI plugin
  };
}
```

At least one entry is required. Paths must stay within the artifact. Build output
records the SDK/runtime compatibility information used to build the UI bundle.

The manager assigns a generation and immutable artifact URL at activation.
Plugin IDs agree across manifest, backend definition, and UI definition.
Installation completes and validates the artifact before desired state points to it.

For cross-plugin custom services or slots, authors may publish an independent
contracts package. Ordinary plugins do not need an additional Fathom package.

## 4. Backend plugin and service contracts

```ts
export const Sessions = defineService<SessionsApi>("fathom.sessions", {
  version: 1,
});

export default definePlugin({
  id: "fathom.sessions",
  config: Type.Object({ retentionDays: Type.Number({ default: 90 }) }),
  requires: { storage: Storage },
  provides: { sessions: Sessions },

  async start({ use, scope }, config) {
    const sessions = createSessions(use.storage, config);
    scope.defer(() => sessions.close());
    return { sessions };
  },
});
```

```text
schema                    → inferred config type + runtime validation
requires                  → inferred use keys and method signatures
provides                  → checked return keys and service interfaces
service token             → stable ID + contract version + TypeScript type
scope                     → owns resources and registrations
```

Schema decoding is an SDK helper using TypeBox, including explicit default
application. Do not assume a TypeBox schema has a `.parse()` method.

Service matching uses stable identity and compatible contract versions, not
JavaScript object reference equality. Only one active provider per service.
Missing providers block consumers; cycles and conflicting providers reject the change.

Top-level module code declares definitions only. `start` creates effects; its
scope cleans them up even if `start` throws before returning.

### Registrations are dependencies too

```ts
export default definePlugin({
  id: "fathom.provider-anthropic",
  requires: { llm: Llm, credentials: Credentials },
  start({ use, scope }) {
    scope.defer(use.llm.register(anthropicProvider()));
    scope.defer(use.credentials.registerLogin(anthropicLogin()));
  },
});
```

```text
reload provider-anthropic
  → stop its registrations → start provider-anthropic
  → llm remains running

reload llm
  → stop ALL transitive requirers, including provider-anthropic and agent
  → replace llm → restart requirers → registrations are recreated
```

A plugin declares every service it uses, including services it registers into.
Registration does not create a reverse restart edge from the registry to the
contributor. One affected set per change prevents duplicate starts.

## 5. Scope, drain, and work ownership

```ts
interface Scope {
  readonly signal: AbortSignal;
  defer(dispose: () => void | Promise<void>): void;
  task(work: (signal: AbortSignal) => Promise<void>): void;
}

// Internal host concept, exposed through appropriate service APIs.
interface WorkGate {
  enterRoot(): Lease;            // rejects while draining/stopped
  close(): void;                 // prevent new root work
  waitForIdle(deadline): Promise<void>;
}
```

```text
stop affected graph
  1. close root-work gates across the entire affected set
  2. allow admitted work to settle up to drain deadline
  3. abort remaining work through scope signals
  4. await settlement up to cleanup deadline
  5. dispose consumers before providers; each scope in reverse registration order
  6. remove services and mark stopped
```

`scope.task` tracks background work; root-operation leases track admitted runs,
requests, and tool executions. A watcher must not keep graceful drain open forever.

Provider/tool registries lease the selected implementation for an invocation.
Unregister prevents new leases; disposal waits for existing leases to settle or
abort. Capturing a registry object alone does not pin its mutable entries.

```text
tool invocation → acquire tool implementation lease
                → persist tool-started
                → execute once
                → persist result or unknown outcome
                → release lease
```

In-process code cannot be forcibly terminated safely. If a task ignores abort or
cleanup cannot release an exclusive resource, report restart-required and do not
start a competing generation against that resource.

## 6. Backend loading and changes

Use the resolve-only generation approach described in the original baseline.
Its reported spike results are prior evidence, not new verification by this plan.

```text
plugin-local module            generation-specific key
bare shared package            shared cached dependency
another plugin's source        forbidden import
```

```ts
registerHooks({
  resolve(spec, context, next) {
    const result = next(spec, context);
    const owner = pluginDirOf(result.url);
    if (!owner) return result;

    // Only inherit a generation within the SAME plugin graph.
    const parent = pluginModuleIdentity(context.parentURL);
    const generation = parent?.id === owner.id
      ? parent.generation
      : generationForCandidate(owner.id);

    return withGeneration(result, generation);
  },
});
```

Actual implementation must normalize file URLs, preserve hook metadata, reject
unauthorized cross-plugin paths, and validate explicit generation tags. Shared
JSR/npm dependencies remain outside plugin-owned URL tagging.

No `load` hook. Fallback: copy the self-contained backend directory to an immutable
generation directory and import there. Both strategies live behind `loader.ts`.
Old ES module graphs remain in memory; repeated development reloads eventually
need a process restart. Measure the shipped runtime rather than assuming fixed cost.

```ts
await changes.run(async () => {
  const candidate = await prepare(change);        // import + validate, old serving
  const proposedGraph = validateGraph(candidate);
  const affected = unionOfOldAndNewDependents(change, proposedGraph);
  const previous = snapshotLastGood(affected);

  await stop(affected, { drainMs: 10_000, cleanupMs: 5_000 });
  try {
    await startProvidersFirst(affected, candidate);
    await publishReadyServicesAndGeneration();
  } catch (error) {
    await disposeAllPartialCandidateScopes();
    await restoreProvidersFirst(previous);        // may itself fail
    recordChangeFailure(error);
  }
  emitCompositionRevision();
});
```

During starting, candidate services are available to the starting dependency
graph but not to new root work. Reopen gates only after successful activation.
Rollback restores code/config where possible; it cannot undo external effects or
database migrations. Baseline migrations must remain compatible with rollback.

```ts
interface PluginStatus {
  id: string;
  desired: { enabled: boolean; source: string; config: unknown };
  backend: {
    state: "stopped" | "blocked" | "starting" | "ready" | "stopping" | "failed";
    activeGeneration?: number;
    lastChangeError?: string;    // can coexist with a restored ready generation
    restartRequired?: boolean;
  };
}
```

Frontend state is tracked separately per connected renderer. Backend `ready`
does not claim every window successfully mounted its UI.

## 7. API boundary: services stay local, wire contracts are explicit

```text
backend service       in-process functions, streams, leases, resource ownership
API contract          serializable request/response/event schemas
browser client        typed HTTP calls and event subscriptions
```

```ts
// Browser-safe shared contract. Same definitions validate both sides.
export const NotesApi = defineApi("acme.notes", {
  list: {
    kind: "query",
    input: Type.Object({ sessionId: Type.String() }),
    output: Type.Array(NoteSchema),
  },
  add: {
    kind: "command",
    input: AddNoteSchema,
    output: NoteSchema,
  },
});

// Backend: Http is declared in requires.
scope.defer(use.http.registerApi(NotesApi, {
  list: ({ sessionId }, request) => notes.list(sessionId, request.signal),
  add: (input, request) => notes.add(input, request.signal),
}));

// UI: inferred arguments and results; no handwritten fetch URLs.
const notes = host.client.api(NotesApi);
await notes.add({ sessionId, text });
```

The bridge defines schema validation, error envelopes, abort handling, unavailable
service responses, and API version checks. Requests capture a handler generation
and acquire its work lease. Route replacement cannot change an admitted request.

All wire values are JSON-compatible. Functions, Solid accessors, service objects,
and credentials do not cross this boundary. Slot props are local renderer values
and may contain accessors and callbacks.

HTTP plugin owns the listener and stable route tables. Feature plugins register
API handlers through disposer-returning registrations. HTTP does not require those
features, avoiding a dependency cycle.

```text
GET  /api/events
GET  /api/sessions
POST /api/sessions
GET  /api/sessions/:id/records?after=<record-seq>
POST /api/sessions/:id/runs
POST /api/runs/:id/cancel
POST /api/runs/:id/approve
GET  /api/models
GET  /api/auth
POST /api/auth/:provider/login
POST /api/auth/:provider/prompt
GET  /api/plugins
POST /api/plugins/:id/{enable,disable,reload,config}
GET  /api/composition
PUT  /api/composition                 revision-checked update
/api/extensions/<namespace>/…         schema-defined plugin APIs
```

### Events and reconnection

```ts
interface EventEnvelope<T> {
  epoch: string;                 // changes when backend starts
  cursor: number;                // global transport cursor within epoch
  type: string;
  payload: T;
}
```

```text
client connects → snapshot with cursor → replay events after cursor → live events
disconnect      → reconnect with epoch + last cursor
cursor retained → replay then resume
cursor expired / epoch changed → explicit reset → refetch authoritative state
```

Snapshot/cursor acquisition and replay subscription must have no lost-event gap.
Use a bounded replay buffer and define its overflow behavior. Session record
sequence numbers are separate from event cursors. Durable records reconstruct
sessions; transient stream deltas can reset after reconnect without inventing output.

## 8. UI host and plugin contract

```ts
export default defineUiPlugin({
  id: "acme.better-composer",
  start({ host, scope }) {
    scope.defer(host.slots.register(ComposerSlot, {
      id: "acme.better-composer/main",
      component: BetterComposer,
    }));
  },
});
```

```ts
interface UiHost {
  slots: SlotRegistry;
  client: AppClient;             // built-in + extensible typed APIs
  workspace: WorkspaceState;    // active session, navigation
  drafts: DraftStore;            // drafts keyed by session
  commands: CommandRegistry;    // semantic actions + keyboard bindings
  desktop: DesktopBridge;
  theme: ThemeState;
}
```

SDK interfaces describe these capabilities; `ui-host` implements them. Built-ins
receive the same object shape. Hosts validate required API/slot versions before
activating plugins; a TypeScript type alone does not establish runtime availability.

Every UI plugin starts inside an owned Solid root. Component instances get their
own owners and error boundaries. Scope disposal removes registrations, unmounts
roots, unsubscribes listeners, cancels work, and releases styles/assets.

## 9. Slots and composition

Two slot kinds are enough for the baseline:

```ts
interface ComposerContext {
  sessionId: Accessor<string>;
  draft: Accessor<Draft>;
  setDraft(next: Draft): void;
  runStatus: Accessor<RunStatus>;
  submit(): Promise<void>;
}

export const ComposerSlot = defineSlot<ComposerContext>({
  id: "fathom.composer",
  version: 1,
  kind: "single",
});

export const ComposerActionsSlot = defineSlot<ComposerContext>({
  id: "fathom.composer.actions",
  version: 1,
  kind: "multiple",
});
```

| Slot | Kind | Host context |
| --- | --- | --- |
| `fathom.workspace` | single | navigation, active session |
| `fathom.sidebar` | single | navigation, session summaries |
| `fathom.session.content` | single | session ID, records, run state |
| `fathom.session.toolbar.actions` | multiple | session ID, commands |
| `fathom.composer` | single | draft, submit, run state |
| `fathom.composer.actions` | multiple | composer context |
| `fathom.settings.sections` | multiple | configuration and capability status |

```tsx
// Built-in workspace layout; external layouts use the same exported Slot.
<WorkspaceFrame
  sidebar={<Slot slot={SidebarSlot} context={navigationContext} />}
  content={<Slot slot={SessionContentSlot} context={sessionContext} />}
  footer={<Slot slot={ComposerSlot} context={composerContext} />}
/>
```

```ts
interface UiComposition {
  revision: number;
  selected: Record<SlotId, ContributionId>;     // single-slot selection
  order: Record<SlotId, ContributionId[]>;      // explicit multiple-slot order
  hidden: ContributionId[];
}
```

Rules:

- Registration makes a contribution available. It does not select a replacement.
- Single slots use explicit selection, then the built-in default, then a host
  empty/error view. Installing a plugin never silently takes over a region.
- Multiple slots use persisted order, then numeric contribution order, then stable
  contribution ID as a tie-breaker. No dependence on load timing.
- Duplicate contribution IDs reject activation. IDs are namespaced by plugin.
- Selection remains in desired composition when a plugin is temporarily missing;
  the UI reports the fallback rather than silently rewriting the preference.
- Custom slots use the same `defineSlot`/`Slot` APIs and declare availability and
  version requirements. Reloading their owner removes the outlets it owns.
- Replacing a parent component replaces its nested outlets. A custom composer must
  render `ComposerActionsSlot` if it wants to preserve that extension point.
- Slot contracts document supported nesting, focus behavior, and accessible labels.
  Detect recursive outlet composition and render an error instead of recursing.

The host keeps a minimal recovery surface outside replaceable slots: failed-plugin
status, disable/reset composition, and reconnect. Ordinary settings and app features
remain plugins.

## 10. Components, hooks, and state ownership

```text
primitives         Button, Dialog, Menu, Tooltip
feature pieces     Editor, AttachmentList, ModelPicker, Message, ToolCall
compositions       Composer, Conversation, SessionList, WorkspaceFrame
hooks              useSession, useRun, useDraft, useCommand
```

```tsx
// Controlled component: usable without a Fathom host.
<Composer
  draft={draft()}
  onDraftChange={setDraft}
  onSubmit={submit}
  disabled={runStatus() === "running"}
/>

// Default plugin adapter: connect public host state to public components.
function DefaultComposer(props: ComposerContext) {
  return <Composer
    draft={props.draft()}
    onDraftChange={props.setDraft}
    onSubmit={props.submit}
    actions={<Slot slot={ComposerActionsSlot} context={props} />}
  />;
}
```

| State | Owner | Replacement behavior |
| --- | --- | --- |
| Sessions, records, runs | backend services | remains authoritative |
| Active session/navigation | UI host workspace | survives feature replacement |
| Drafts and pending attachments | UI host draft store | survives composer replacement |
| Query cache and subscriptions | shared UI client | consumers attach/detach |
| Selection of slot contributions | persisted composition | survives restart |
| Expanded menus/local input focus | component owner | may reset on replacement |
| Plugin-specific durable data | plugin via public storage/API contracts | plugin defines migration |

Baseline drafts survive plugin reload and session navigation. Persistence across
app restarts is a separate explicit policy; do not imply it from in-memory ownership.

Primitives and controlled components do not reach into hidden app singletons.
Hooks requiring the host obtain the documented public context. Built-in feature
plugins perform the same wiring external authors perform.

## 11. Theme, Tailwind, and shared runtime

Everything is under the SDK's UI namespace:

```text
@fathom/sdk/ui/theme             typed tokens, theme definitions, style helpers
@fathom/sdk/ui/tailwind          supported Tailwind integration
@fathom/sdk/ui/components        production components
@fathom/sdk/ui/hooks             production behavior hooks
```

```css
/* Shared semantic tokens. Exact names become public API. */
:root {
  --fathom-surface: …;
  --fathom-text: …;
  --fathom-accent: …;
  --fathom-radius-control: …;
}
```

```text
host build
  → base/reset once + SDK component styles + active theme

plugin build
  → scan plugin source + compile its utility classes + collect its assets
  → plugin-owned CSS with agreed cascade layers and scoping

plugin activation
  → load styles → register UI → mount selected contributions
plugin disposal
  → unmount UI → release styles when no mounted owner uses them
```

External plugins do not require a host rebuild for Tailwind class discovery.
The generated setup pins supported compiler versions and defines reset ownership,
cascade ordering, portal styling, and selector scoping. Build-generated selectors
must avoid accidental collisions between plugin bundles. CSS is not a security wall.

The browser resolves Solid, renderer/context-bearing SDK modules, and host-shared
components through one host-controlled module map established at boot. Plugin
builds externalize those imports. Reject incompatible builds rather than loading
an isolated second copy of the runtime or host contexts.

```text
plugin source + SDK dependency
  → supported Solid compiler + shared-import configuration
  → browser ESM + CSS + assets
  → host maps external SDK/Solid imports to compatible singleton modules
```

Publication gate: prove JSR source exports, generated declaration files, Solid
compilation, and stylesheet/asset delivery in a clean consumer. The supported
build tool may emit packaged theme assets; do not assume arbitrary `.css` export
paths work identically in every JSR consumer. The author still installs one SDK.

## 12. UI loading, activation, and failure

Appending `?gen=N` to an entry module does not refresh its imported chunks.
Serve each complete UI artifact from an immutable path:

```text
/plugins/acme.better-composer/<generation>/<hash>/entry.js
/plugins/acme.better-composer/<generation>/<hash>/chunks/editor.js
/plugins/acme.better-composer/<generation>/<hash>/styles.css
```

```text
composition revision received
  → reconcile against authoritative plugin snapshot
  → check SDK/API/backend generation requirements
  → import candidate entry and load CSS
  → start candidate in a scope with staged registrations
  → validate staged IDs, slots, and compatibility
  → commit registry changes in one synchronous batch
  → unmount old roots, mount selected candidate roots
  → dispose old plugin scope and release assets
```

Before commit, the previous UI remains active. Failed staging disposes the
candidate scope. Staged scopes cannot claim exclusive global resources; such
resources must be acquired through host-managed registrations.

A post-commit rendering error is caught at the contribution boundary. Quarantine
that contribution for the current generation and show the configured fallback.
Do not repeatedly remount a known-broken candidate. Retain the old module/artifact
for recovery only if its API/backend compatibility still holds.

```text
backend-only plugin        backend lifecycle only
UI-only plugin             UI lifecycle only
combined plugin            backend activation → announce compatible UI artifact
backend fails/disabled     dependent UI becomes unavailable; host selects fallback
UI fails in one window     backend can remain ready; that renderer reports failure
```

Frontend/backend activation is not a distributed transaction. Every request has
version/availability checks; a mounted old UI can briefly encounter an unavailable
backend during reload. UI controls show that state without silently retrying mutations.

## 13. AI, credentials, agent, and persistence

```text
sdk/ai/
  transport/           SSE reader, fetch/abort, retry classes, error mapping
  protocols/           Anthropic Messages, OpenAI Responses, OpenAI Chat
  auth/                PKCE loopback, device-code utilities, credential file helpers
  messages.ts          Message, Part, ToolCall, StreamEvent

provider plugin
  → protocol + model metadata + credential flow + typed provider quirks
  → scoped registration into llm and credentials
```

```ts
interface LlmApi {
  register(provider: Provider): Dispose;
  models(): ModelInfo[];
  stream(options: StreamOptions, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

interface ToolsApi {
  register(tool: Tool): Dispose;
  schemas(): ToolSchema[];
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

interface CredentialsApi {
  get(provider: string): Promise<Credential | undefined>;
  status(): CredentialStatus[];
  registerLogin(flow: LoginFlow): Dispose;
  login(provider: string, ui: LoginUi): Promise<void>;
}
```

No vendor SDK requirement. Providers share protocol implementations. Preserve
provider-specific metadata for replay. Credential refresh is single-flight;
secrets stay out of records, browser responses, and logs.

```text
UI submit
  → typed agent command, with request ID
  → acquire session run gate (one active run/session)
  → persist run
  → runAgent(input, public dependencies, signal)
      → sessions.history
      → llm.stream [provider lease + credential resolution]
      → persist assistant response
      → for each tool call
          validate args → await approval if needed
          acquire implementation → persist started → execute once → persist outcome
      → next step or finish
  → durable records + transient stream events
  → shared client state → selected conversation/composer components
```

Approvals bind to a run, tool call, and exact validated arguments. Cancel/reload
settles pending approvals. Tools receive explicit workspace `cwd` and abort signal.
Retries are classified: never automatically retry an ambiguously completed tool
or mutating command. Request IDs deduplicate run creation after transport retries.

```text
fathom.db, owned by storage
  sessions      id, cwd, title, created_at
  runs          id, session_id, request_id, status, created_at
  records       session_id, seq, run_id, kind, payload_json
  migrations    namespace, version
```

Append-only records derive model history. Transactional constraints enforce one
active run and per-session sequence allocation. On startup, reconcile unfinished
runs as interrupted; a started tool without a persisted outcome stays unknown.

Plugin storage uses namespaced access/migration contracts; UI plugins use APIs.
No direct browser sqlite access. Document schema downgrade limits before attempting
rollback across a migration.

## 14. Desktop, discovery, and trust

```text
desktop process bootstrap
  → resolve app home and desired composition
  → boot kernel and backend plugins
  → HTTP listens on 127.0.0.1:<random-port>
  → create native window
  → deliver per-launch authentication through controlled bootstrap
  → load UI host → activate built-in/external UI plugins

window close / app quit
  → stop accepting new work
  → drain or cancel runs according to explicit quit policy
  → dispose UI, native resources, backend scopes
  → close listener and sqlite
```

```ts
interface DesktopBridge {
  capabilities(): DesktopCapabilities;
  pickFiles(options: PickFilesOptions): Promise<SelectedFile[]>;
  openExternal(url: string): Promise<void>;
}
```

Browser development supplies an adapter with explicit unsupported capabilities.
Plugin code does not import a native binding. Attachment access uses host-issued
handles and documented APIs rather than pretending every browser has filesystem access.

Choose the native binding through a packaged-app spike on declared target OSes.
Prove window lifecycle, external links, file selection, production assets, external
plugins, and cleanup. Release work includes installer/app bundle, signing where
required, writable user data paths, and launching without a development toolchain.

HTTP authenticates APIs and events, validates origin/host where applicable, and
does not enable wildcard CORS. Avoid long-lived tokens in URL logs. The client uses
an authenticated streaming fetch for SSE when bearer headers are needed. Define
the native bootstrap channel and a separate development authentication flow.

```text
discovery sources
  built-in      app resources/plugins/
  global        $FATHOM_HOME/plugins/<id>/
  project       <cwd>/.agents/fathom/plugins/<id>/   trust before execution
  installed     $FATHOM_HOME/installed/<id>/<version>/
```

Read manifests before importing code. ID collisions name both sources and block
activation. Remember trust for canonical project locations; do not follow an
untrusted project entry into execution during discovery.

```text
$FATHOM_HOME/
  composition.json             desired backend plugins + UI slot choices
  settings.json                trust and application settings
  auth.json                    mode 0600, single writer, atomic rename
  fathom.db
  plugins/
  installed/
  artifacts/                   immutable generated plugin artifacts
```

Installation stages downloads, checks manifests/paths/compatibility, then atomically
promotes the completed artifact. No install script executes before trust. SDK
publication to JSR and distribution of complete UI plugin artifacts are separate
concerns; the first external fixture installs a local artifact. Remote installation
must preserve UI assets as well as backend source.

## 15. Type safety and compatibility

| Boundary | Compile-time guarantee | Runtime check |
| --- | --- | --- |
| Plugin config | schema-inferred type | decode/default/validate |
| Required services | declared keys and typed methods | provider presence/version |
| Provided services | declared keys and interfaces | registration shape/uniqueness |
| API calls | typed input/output/events | schemas, version, auth, availability |
| Slot contributions | token-inferred component props | slot/version/ID availability |
| Components | public props and hooks | normal UI error containment |
| Published artifact | public imports and browser boundaries | manifest/runtime compatibility |

TypeScript cannot prove that arbitrary dynamically imported code implements its
declared behavior. Validation and lifecycle containment remain necessary.

One SDK version covers the public surface. Service/API/slot contract versions allow
the host to identify incompatible capabilities. Begin with a narrow supported SDK
range; widen it only after compatibility checks pass. Generated author projects pin
their SDK and lock dependencies. Build tooling checks JSR-compatible exported types.

## 16. Implementation order and acceptance gates

| Step | Deliverable | Required evidence |
| --- | --- | --- |
| 1 | Public SDK skeleton + package exports | clean external consumer type-checks; UI imports contain no backend code |
| 2 | Kernel loader, scopes, graph, queue | generation isolation, dependency restart, partial-start cleanup, rollback failure reporting |
| 3 | HTTP bridge + browser client | typed custom API, authenticated SSE, gap-free reconnect/reset, cancellation |
| 4 | UI host + typed slots + theme pipeline | explicit replacement, deterministic contributions, disposal and fallback |
| 5 | Session view + default composer | built-ins use public components/hooks/slots exclusively |
| 6 | External replacement fixture | outside workspace, distributed SDK, own styles, preserved draft, custom API |
| 7 | Packaged desktop proof | external plugin loads without dev server/toolchain; native lifecycle works |
| 8 | AI/tools/run path | streaming turn, approval, cancel, interrupted-run recovery, provider/tool drain |
| 9 | Install/watch/config UX | desired/actual reporting, trust, debounced reload, persisted composition |

```text
external fixture must prove
  install one SDK
  define a typed backend plugin
  expose and consume a custom typed API
  add a composer action
  replace composer using exported components and hooks
  compile and load its own Tailwind styles
  reject invalid service keys and slot props at type-check time
  survive disable/reload without losing host-owned draft
  show fallback after a deliberate render failure
  run in packaged desktop app
```

```text
kernel integration cases
  nested module edit; syntax error keeps old generation
  JSR/npm dependency unchanged by generation tagging
  atomic-save watcher renames + debounce
  simultaneous changes share one deduplicated affected graph
  registry restart recreates contributor registrations
  admitted tool invocation drains while new work is refused
  partial start disposes every acquired resource
  failed rollback reports actual failed/blocked state
  config-only change follows the same activation path
  uncooperative cleanup reports restart-required

UI integration cases
  complete chunk graph changes between generations
  incompatible SDK/runtime rejected before mounting
  staged registrations leave old UI intact on preparation failure
  post-commit render failure reaches a usable fallback
  parent replacement documents omitted nested slots
  CSS removed only after old mounts stop using it
  reconnect cannot miss a composition revision
  backend reload while UI is mounted yields explicit unavailable state
```

CI copies the external fixture outside the workspace and consumes distributable
SDK files. No monorepo aliases, private source paths, or unpublished dependencies.
The first real SDK release additionally verifies the JSR install path.

## 17. Deferred

- Worker hosts, sandboxing, per-plugin permissions.
- Marketplace, automatic updates, broad third-party package-manager support.
- Multiple simultaneous SDK/Solid runtimes in one renderer.
- Arbitrary DOM patching and automatic preservation of component-local state.
- Multi-window synchronization beyond authoritative backend/composition state.
- Parallel tools, subagents, branching, compaction.
- Keychain integration, multiple credential accounts, per-project credentials.

Baseline completion means an external author can add backend behavior, contribute
UI, or replace a major region using one SDK and the same contracts as built-ins.
