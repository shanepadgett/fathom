# Fathom Baseline — Live Plugins

Every application capability is a plugin. Built-ins use the same contract as
outside plugins. Enable, disable, configure, and replace them while the app runs.

The recommendation is **Deno module workers, one per reloadable plugin**, with
a small shared runtime. No Cordis. Reload replaces a worker, not the application.

This is a proposed design, not a tested implementation. The first build proves
the reload boundary before we build the harness. Examples are TypeScript
sketches; `@fathom` is a placeholder scope.

## The boundary

```text
stable kernel
  ├─ worker lifecycle and service connections
  ├─ serialized composition changes
  ├─ tracked host resource handles
  └─ app window, HTTP listener, recovery controls

reloadable plugins
  ├─ storage, sessions, credentials
  ├─ model providers, tools, approvals
  ├─ context building, agent loop, runs
  ├─ HTTP routes, UI, commands
  └─ plugin management, source watching
```

The kernel keeps the app alive while its parts change. It does not contain the
agent, provider logic, database schema, or tool policy.

Turning off storage can suspend chat. Turning off the UI removes its views.
Neither action closes the app or removes the recovery controls.

The kernel itself is the exception: replacing Deno, the worker protocol, or the
kernel needs an application update. A loader cannot unload itself and still
load its replacement. Everything above that boundary is live-reloadable.

## Why this runtime

Deno's `--watch-hmr` can fall back to a full process restart. It is a development
tool, not the application's plugin lifecycle.

Cordis provides useful in-process lifecycles, but does not by itself solve fresh
Deno ESM loading and reclamation of old module instances. DeepSeek Harness's HMR
implementation uses Node loader internals and still has restart-only cases.

Use a separate worker and an immutable code artifact instead:

```text
plugin revision A → worker A → drain → dispose → terminate
plugin revision B → worker B → start → publish services

app window, listener, other plugin workers: unchanged
```

This costs asynchronous service calls and a worker per plugin. It also means
owning a lifecycle manager and one message protocol. Deno does not supply those.
Do not add Cordis on top and maintain two competing lifecycle systems.

## Layout

```text
apps/
  desktop/                 starts the kernel and opens the window
  headless/                same kernel; no window
packages/
  sdk/                     plugin, service, schema, and ownership contracts
  runtime/                 workers, connections, reload coordinator, artifacts
  ai/                      model contracts and reusable provider adapters
  agent/                   message types and reusable loop functions
plugins/
  storage-sqlite/
  sessions/
  credentials-local/
  models/                  provider registry
  provider-anthropic/
  provider-openai/
  tools/                   tool registry and guarded execution
  workspace-local/
  tools-coding/
  approval/
  context/
  agent-loop/
  runs/
  api/
  ui/                      Solid application and browser entry
  plugin-manager/
  source-watch/
deno.json
deno.lock
```

A plugin is a lifecycle boundary, not necessarily a published package. Group
closely related tools into one plugin. Do not create a worker per helper.

Libraries contain ordinary functions and types. Plugins wire those functions
to services and own their resources. The same agent loop can run in a test or
another application without starting a plugin runtime.

```text
plugin implementation → reusable library
          ↓
      SDK contracts

runtime → SDK contracts
libraries never import the runtime
```

## Composition

The app starts from data, not a hardcoded constructor graph.

```ts
const app = await boot({
  entries: [
    { id: "storage", artifact: builtin("storage-sqlite"), enabled: true },
    { id: "sessions", artifact: builtin("sessions"), enabled: true },
    { id: "models", artifact: builtin("models"), enabled: true },
    { id: "anthropic", artifact: builtin("provider-anthropic"), enabled: true },
    // credentials, tools, approval, context, agent, runs, API, UI...
  ],
});

await app.enable("anthropic");
await app.configure("anthropic", nextConfig);
await app.replace("anthropic", nextArtifact);
await app.disable("anthropic");
```

All four operations enter the same change queue. UI actions, file edits, and
package updates use that queue; none mounts or disposes plugins independently.

Keep desired state separate from actual state:

```ts
interface PluginStatus {
  id: string;
  desired: { enabled: boolean; revision: string; config: JsonValue };
  actual: {
    state: "disabled" | "blocked" | "starting" | "ready" | "draining" | "failed";
    revision?: string;
    reason?: string;
  };
}
```

Disabling a dependency blocks its consumers; it does not change their desired
settings. Enabling it restores them in dependency order. Cycles and duplicate
service providers are errors, not plugins waiting forever.

The kernel persists the accepted composition and operation status. Interrupted
changes are reconciled on startup. The UI never reports a change as applied
merely because its settings were saved.

## Plugin contract

One definition supplies the module contract and its data-only manifest. The
manifest is built ahead of time, so dependencies can be checked before execution.

```ts
export default definePlugin({
  id: "fathom/sessions",
  apiVersion: 1,
  config: SessionsConfig,
  requires: { storage: Storage },
  provides: { sessions: Sessions },

  async start({ use, provide, scope }, config) {
    const sessions = createSessions(use.storage, config);
    scope.defer(() => sessions.close());
    provide.sessions(sessions);
  },
});
```

`use` contains only declared dependencies. `provide` accepts only declared
services. There is no global context augmentation or unchecked `ctx[name]`.
The SDK infers config from its schema and validates disk config at runtime.

Module top levels only declare exports. Resource acquisition starts in `start`
and belongs to its scope. Staging may evaluate trusted code, but never calls
`start` or supplies live service connections.

Services have plain capability names. Compatibility lives in their metadata:

```ts
export const Sessions = defineService({
  id: "fathom/sessions",
  version: 1,
  methods: {
    load: method(SessionIdSchema, SessionSnapshotSchema),
    append: method(AppendSchema, SequenceSchema),
  },
});

// Inside a consumer: a typed local-looking call, executed by the owner worker.
const snapshot = await use.sessions.load({ sessionId }, { signal });
```

The loader checks the plugin API and required service versions before activation.
Start with exact contract-version matching, not automatic negotiation or adapters.
Changing an implementation does not change its contract version. An incompatible
contract change does, and consumers must update before they can connect.

Keep the three kinds of change separate:

```text
code revision       identifies the artifact being loaded
contract version    checks whether plugins can communicate
storage version     determines how persisted data is read or migrated
```

None needs a suffix on everyday service or type names. Do not introduce parallel
versioned APIs until two incompatible contracts actually need to coexist.

Use one existing schema library for runtime parsing and TypeScript inference.
Do not maintain separate handwritten wire types and validators.

Across workers, exchange data and resource IDs. Never pass class instances,
closures, database handles, or arbitrary object graphs. Local code can compose
functions freely; cross-plugin composition uses service contracts.

## Connections and contributions

The runtime implements one transport for method calls, streams, and cancellation.
Do not write a provider-specific or plugin-specific RPC layer.

```text
caller SDK → kernel connection → owning worker → service implementation
             pins generation

wire messages:
  call / result / error / cancel
  stream-open / pull / chunk / end
```

Every call carries a call ID and the target plugin generation. Arguments,
results, and errors are checked at the boundary. Dead workers fail outstanding
calls explicitly. The runtime never silently retries a call on a new worker.

Streams are pull-driven with bounded buffers. Batch small token deltas. Abort
travels as a message; do not try to serialize an `AbortSignal`. Cancelling a
stream closes the producer as well as the reader.

Many providers can contribute to one registry without providing the same service:

```ts
export default definePlugin({
  id: "fathom/provider-anthropic",
  apiVersion: 1,
  requires: { models: Models, credentials: Credentials },
  config: AnthropicConfig,

  async start({ use, scope }, config) {
    const provider = createAnthropicAdapter({ credentials: use.credentials, config });
    const endpoint = scope.expose(ModelProvider, provider);
    await scope.register(use.models, {
      id: "anthropic",
      models: provider.catalog,
      endpoint,
    });
  },
});
```

`scope.expose` creates an owned endpoint; it does not send `provider` through
`postMessage`. `scope.register` records ownership and obtains a removal handle.
The runtime revokes endpoints on death; registries remove that owner's entries.

Registrations carry their owner generation. The published composition decides
which generations are visible; startup contributions stay staged until the whole
change is ready. Tools, models, routes, and UI entries use this same rule.

```text
one service owner: Models
many owned contributions: anthropic, openai, xai
```

Use services for actions, explicit ordered transforms for context and policy,
and events for observation. An event subscriber cannot become an accidental
permission check or persistence barrier.

## Ownership

Every resource belongs to a plugin scope or a child task scope.

```ts
scope.defer(closeClient);
scope.listen(source, listener);
scope.task(async signal => watchFiles(signal));
scope.spawn(command);  // tracked host process handle; not an untracked child
```

Disposal stops new work, aborts owned tasks, joins them, then releases resources
in reverse order. Attempt every cleanup even if one fails. Failed startup uses
the same path.

The kernel tracks host processes and handles created through the SDK so a dead
worker cannot orphan them unnoticed. Process-tree termination is implemented and
tested per OS. Plugins must not start hidden work outside these scopes.

Worker termination is the last step, not a substitute for cleanup. It cannot
undo a file write or prove that an external command had no effect. A worker is
also not a security sandbox when it inherits broad permissions.

## Reload

Two graphs have different jobs:

```text
source imports       which artifacts must be rebuilt after a file changes
service dependencies which plugins must stop and start together
```

A plugin must not import another plugin's implementation. Import shared
libraries, or depend on the other plugin's service. This keeps reload boundaries
visible.

One change follows this sequence:

```ts
await changes.run(async () => {
  const candidate = await prepareArtifact(change); // trust, build, schema, versions
  const plan = planChange(candidate, currentComposition);
  await validateInStaging(candidate);              // no start call or live connections

  const gate = closeAdmission(plan.affected);
  try {
    await settleWork(plan.affected, change.mode);   // drain, or cancel and join
    await stopConsumersFirst(plan.oldInstances);
    await startProvidersFirst(plan.newInstances);  // private until all are ready
    await publishComposition(plan);                // switch routing + status
  } catch (error) {
    await recoverOrMarkFailed(plan, error);
  } finally {
    gate.release();                                // only ready instances admit work
  }
});
```

Preparation happens while the old plugin serves work. Once stopping begins,
the affected capabilities can be briefly unavailable. No claim of uninterrupted
service while replacing a database writer or a running tool.

| Change | Effect |
| --- | --- |
| Provider code | replace that provider; settle runs using its generation |
| Tool bundle | replace that bundle; settle runs holding its tool catalog |
| Required service | stop its dependent plugins too; restart in dependency order |
| Config | same lifecycle as code replacement; no half-mutated live config |
| Disable | stop affected work; remove contributions; block required consumers |
| Enable | validate dependencies; start; publish only when ready |
| Shared source library | rebuild and replace every affected artifact |

Before admission, a run leases its selected model, tools, and pipeline. Those
generations remain fixed until the run settles. Normal service calls also hold
short-lived leases. No lookup can secretly switch implementations halfway through.

Draining rejects new root work, not calls needed by existing leases to finish.
Cancellation instead aborts those leases. This distinction prevents the reload
gate from deadlocking the work it is waiting for.

The UI shows affected plugins and runs. Default to draining current runs; offer
explicit cancellation for faster replacement. Disabling permission or credential
access closes new-call admission immediately and cancels affected work.

A deadline can mark reload blocked. It cannot make an in-process external effect
safe to repeat. Forced worker termination reports interrupted work and verifies
tracked resource cleanup before allowing replacement access.

Unrelated workers keep running. Replacing shared storage may pause most of the
harness, but the window and recovery controls remain available.

## Failure and state

```text
build / type / manifest failure → old revision stays active
drain cannot settle             → blocked; show pending work and choices
new start fails                 → clean new scope; try previous revision
recovery also fails             → affected plugins failed; app stays open
```

Rollback means starting the previous artifact again, not reviving the old heap.
Keep its artifact and config until replacement succeeds. Never promise rollback
of database migrations, network actions, or commands.

Automatic reload allows only backward-compatible storage changes. Destructive
migrations need an explicit maintenance operation and backup.

Durable application state belongs in storage, not a module singleton:

```text
session records / settings / credentials → durable stores
caches / clients / subscriptions          → recreate on start
in-flight tool effects                    → settle or mark outcome unknown
```

No generic serialization of arbitrary plugin memory. A plugin that needs a
checkpoint defines a small versioned data schema. Its startup decides whether
that checkpoint is compatible.

## Deno code loading

Build each backend plugin into an immutable ESM artifact with its private code
dependencies included. Keep source maps, a source dependency list, and declared
assets beside it.

```text
$FATHOM_HOME/artifacts/<plugin-id>/<content-hash>/
  manifest.json
  worker.js
  worker.js.map
  assets/
```

```ts
const worker = new Worker(artifact.workerUrl, { type: "module" });
// Handshake → validate manifest → inject service handles → start → ready.
// On replacement: await graceful stop, then worker.terminate().
```

Never overwrite a live artifact. A changed transitive dependency changes the
artifact hash. Old and new revisions use different URLs and workers; no ESM
cache deletion or timestamp query trick is needed.

Start with `deno bundle` behind the artifact builder. It is experimental: pin
Deno, test the emitted artifacts, and keep that command out of the SDK contract.
Prebuilt installations do not need a compiler during normal activation.

Reject undeclared dynamic code imports and unresolved mutable dependencies.
Runtime built-ins can stay external. Native addons and dependencies that cannot
be bundled need an explicit supported packaging path; reject them until tested.
Do not silently run an incompatible plugin inside the kernel.

The watcher plugin watches source directories, including atomic-save renames,
debounces changes, and asks the artifact builder for a candidate. The coordinator
discards stale builds so an older completion cannot replace a newer edit.

Package installation prepares a new immutable artifact before requesting a
switch. It does not mutate the active dependency tree.

## AI and agent services

```text
runs
  ├─ sessions → storage
  ├─ context
  ├─ agent-loop
  │    ├─ models registry → selected provider → credentials
  │    └─ tools executor → approval → selected tool → workspace
  └─ durable records + display progress
```

The agent loop is an ordinary function exposed by the `agent-loop` plugin.
Providers use a Fathom model contract; start with AI SDK provider adapters rather
than hand-writing every vendor's transport.

```ts
async function runAgent(input, deps, signal) {
  for (let step = 0; step < input.maxSteps; step++) {
    signal.throwIfAborted();
    const request = await deps.context.build(input, { signal });
    const answer = await collectCompleteResponse(deps.model, request, signal);
    await deps.sessions.append(assistantRecord(answer));

    if (answer.stop !== "tool-calls") return resultFor(answer.stop);

    for (const call of answer.toolCalls) {
      await deps.tools.execute(call, { signal });
    }
  }
  return { status: "limit-reached" };
}
```

Keep session records, model messages, and display progress separate. Preserve
provider-owned metadata needed to replay reasoning and tool calls. Reject
unsupported features instead of silently dropping them.

Only complete, validated responses can trigger tools. EOF without completion
fails the request. Truncation and refusal are explicit outcomes. Tools run
sequentially initially; parallelism requires declared independence.

Retry in one layer, before exposed model output, for classified transient errors.
Never replay a tool or a partly emitted answer automatically. Disable overlapping
retries in provider dependencies.

## Tools, approval, and credentials

```text
leased tool generation
  → parse and normalize arguments
  → authorize this invocation
  → commit tool-started
  → execute once
  → commit result
```

Approval binds to the run, tool generation, arguments, and workspace. A changed
invocation needs a new decision. Missing approval service, timeout, or policy
failure denies execution. Reload never becomes an approval bypass.

Workspace services own path handling, working directories, environment filtering,
output limits, and process cleanup. Tool implementations reuse them. A local
workspace is not a shell sandbox; approved commands retain their OS authority.

Credential providers expose resolution and status separately. Resolve secrets
only for approved provider plugins; never include them in transcripts or traces.
Start with stored API keys and read-only environment fallbacks. OAuth flows are
plugins added only for supported provider integrations.

```text
$FATHOM_HOME/                 default: ~/.agents/fathom
  composition.json           desired entries and accepted configuration
  auth.json                  initial local credential backend
  sessions.db                SQLite application store
  artifacts/                 immutable code revisions
```

One app instance owns the data directory. Credential writes are atomic with
private OS-appropriate access controls. Plaintext storage is stated in the UI.
Refresh is single-flight per credential and saves rotated tokens before use.

## Sessions and recovery

The SQLite plugin is the sole database owner. Other plugins call narrow storage
operations; they do not acquire its connection. Validate the chosen driver in a
worker on every supported OS before adopting it.

```text
sessions   id, workspace, created_at
runs       id, session_id, request_id, status, composition_revision
records    session_id, sequence, run_id, schema_version, kind, payload
```

One active run per session. Run creation and its user input commit atomically.
The same request ID and payload return the existing run; a changed payload is a
conflict. Reloaded run services reconstruct this state, not an empty busy map.

Await durable writes before publishing their events or starting dependent
effects. On write failure, stop the run. A subscriber is never the writer.

A tool-started record without a result has an unknown outcome. Recovery does not
rerun it. Report the interruption and require an explicit next action. There is
no exactly-once guarantee for external effects.

## HTTP and UI plugins

The kernel owns the listener, authenticated transport, and a small recovery page.
API plugins register owned route endpoints. Replacing a route plugin does not
rebind the port. Requests to a suspended capability return a clear unavailable
response; existing requests follow their generation's drain policy.

```text
POST /api/v1/sessions/:id/runs       accept input; return run ID
POST /api/v1/runs/:id/cancel         cancel explicitly
POST /api/v1/runs/:id/approvals/:id  resolve approval
GET  /api/v1/events                 replay records, then live progress

kernel management surface          inspect / enable / disable / replace plugins
```

Closing the UI does not cancel a run. Durable events carry sequences for
gap-free replay; token progress is temporary. Reconnect loads a snapshot and
continues after its sequence. Bound buffers and disconnect slow readers.

UI code has a separate browser lifecycle. Each UI plugin mounts in an owned
iframe using a revisioned browser artifact. Replace the frame, not the desktop
window. This discards its old module graph instead of accumulating cache-busted
Solid modules in the shell.

The SDK bridge exposes declared commands and view state; plugins do not share
DOM nodes or Solid context across frames. Validate frame identity and bridge
messages. Preserve durable navigation and view state outside the replaced frame.
Use the same ownership and operation IDs for backend and UI changes, and report
partial failure honestly.

Bind HTTP to loopback, validate Host and Origin, authenticate every API, and avoid
wildcard CORS. A worker or iframe boundary is not a substitute for plugin trust.

## Discovery, trust, and publishing

Discovery reads manifests; it does not import code.

```text
built-in catalog
$FATHOM_HOME/plugins/
<project>/.agents/fathom/plugins/    proposed entries; approval before execution
installed packages                 pinned versions and lockfile
```

Reject duplicate entry IDs, incompatible contracts, invalid config, and manifest
claims that disagree with the worker handshake. Validate before publishing any
service or contribution.

Trust applies to resolved code and dependencies. Approve before running build
scripts or evaluating modules. Local development can explicitly trust a source
tree for automatic rebuilds; that permission is not silently given to a project.

Workers inherit permissions unless explicitly restricted. Initial plugins are
trusted code. Do not claim malicious-plugin isolation. A schema check proves
shape, not behavior.

Publish the SDK, service contracts, and reusable libraries to JSR after an
outside plugin passes reload tests. Keep the worker wire protocol private to
the matching SDK/runtime release. Public services and plugin manifests have
explicit compatibility versions. Never resolve `latest` during activation.

## First proof

Prove these with a tiny service and consumer before adding providers or UI:

```text
start A → consumer calls A
edit A's imported helper → build B → consumer calls B
disable B → consumer blocked → enable B → consumer restored
bad candidate → A or B remains usable
cancel active stream → cleanup settles → replacement starts
repeat replacement → old workers, listeners, and handles do not accumulate
```

| Boundary | Required test |
| --- | --- |
| Deno artifacts | transitive edit, dependency update, fresh worker, native-driver compatibility |
| Lifecycle | enable, disable, config change, dependency cascade, cycle rejection |
| Failure | failed staging, failed start, failed cleanup, worker crash, failed recovery |
| Calls | cancellation, bounded streams, stale generation, no automatic replay |
| State | storage reload, durable run ownership, interrupted tools, schema compatibility |
| Isolation of reload | unrelated stream continues; window and listener stay alive |
| UI | frame replacement, bridge cleanup, restored view state |

Measure worker memory and service-call latency here. Batch hot paths; keep
fine-grained helpers inside a plugin. Do not weaken reload semantics to hide a
failed compatibility or performance test.

The unknowns are implementation gates, not claims already proved: artifact
coverage, driver support, cleanup across OSes, and repeated-reload memory use.

## Deferred

- Sandboxed third-party code and remote execution.
- Plugin marketplace and automatic updates.
- Native dependencies without a tested packaging path.
- Parallel tools, session branches, steering, and subagents.
- Keychain storage, multiple accounts, and provider-specific OAuth.

Live code reload, package revision switching, enable/disable, dependency cleanup,
and failure recovery are baseline requirements, not deferred features.

## Sources

- [Deno watch and HMR](https://docs.deno.com/runtime/run/watch_mode/): restart fallback.
- [Deno workers](https://docs.deno.com/api/web/workers/): module workers, messaging, termination.
- [Deno bundling](https://docs.deno.com/runtime/reference/cli/bundle/): bundled ESM; experimental tool status.
- Supplied `deepseek-harness/packages/boot/hmr/README.md`: serialized changes and Node-loader constraints.
- Supplied `deepseek-harness/packages/boot/plugin-manager/README.md`: live composition and package-replacement limits.
- Supplied `deepseek-harness/docs/cordis-api/fiber.md`: owned effects and awaited disposal.
- Supplied `ai/architecture/provider-abstraction.md` and `pi/packages/agent/README.md`: reusable model and agent boundaries.
