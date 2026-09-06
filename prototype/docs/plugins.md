# Plugin authoring

A composition chooses implementations. The kernel knows how to mount and dispose
plugins; it does not own agent behavior.

## Backend contract

Export a manifest as the default export of a JavaScript or TypeScript module:

```js
export default {
  id: "my-tool",
  apiVersion: 1,
  requires: ["tools"],
  activate(ctx) {
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "greet",
        description: "Return a greeting.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => Promise.resolve("Hello from an external plugin"),
      })
    );
  },
};
```

Add its path to `plugins` in a composition JSON file. Relative paths resolve
from that JSON file's directory. Built-in IDs resolve through the bundled
catalog. External modules use normal file imports. The tested no-build
distribution format is a JavaScript ES module with relative imports. Packages
with npm dependencies should be bundled before distribution; arbitrary new npm
dependencies inside a compiled desktop executable have not been verified.

`requires` declares service dependencies. `provides` declares exclusive service
ownership. Duplicate providers, duplicate IDs, unsupported API versions, missing
dependencies, and dependency cycles fail startup. The host sorts the graph, then
mounts each plugin through Cordis with explicit injections.

`ctx.get(key)` reads a declared dependency. `ctx.provide(key, implementation)`
registers a declared service with Cordis. `ctx.effect(setup)` tracks the
disposer returned by setup. Effects unwind in reverse order. `ctx.cordis`
exposes the native context for advanced Cordis integrations. Harness service
keys use a `fathom:` prefix inside Cordis to avoid collisions with framework
properties.

Keep resources scoped to the plugin's lifecycle. Close subscriptions, timers,
and processes in disposers. Activation failure rolls back the mounted
composition. Runtime replacement is coordinated while idle, not midway through a
running turn.

## Replace a service

Remove the default provider from the composition and add your provider. A
runtime implements `RuntimeService` from `src/contracts/session.ts`: an `id` and
`run(text, signal)`. The controller handles admission, status, and cancellation;
the runtime writes messages through the session contract.

The default runtime consumes `model`, `sessions`, `tools`, and `context`.
`context-default` owns the prompt and can be replaced to change prompt assembly,
history selection, or exposed tool schemas. The model adapter owns conversion to
pi-ai messages and its continuation metadata. The runtime never imports pi-ai.

Each tool is a contribution to the tool registry. A replacement registry can
alter execution behavior without rewriting individual tool plugins. The registry
currently validates tool identity and delegates argument validation to each
tool.

`Services` is an extensible TypeScript interface. Plugin authors developing in
this workspace can augment it with declaration merging for additional typed
services. JavaScript plugins can register additional service keys directly
through their manifest and context. Public contract packaging/version
negotiation beyond API version 1 is future work.

## Frontend contract

The UI bootstrap loads only modules listed in `uiPlugins`. Entries starting with
`/ui/` refer to bundled assets; other entries refer to local files relative to
the composition file. Modules export `{ id, activate(host) }` and may declare
`apiVersion: 1` and `requires: [pluginId]`.

The frontend host supports views, message renderers, commands, state
subscription, and a transport API. Registrations belong to their activating
plugin and are removed on failure or disposal. Unlike backend services, frontend
dependencies currently require explicit order in the composition.

The default shell renders views in `main` and `rail` slots. Replace the shell to
change navigation and layout; replace the conversation plugin to change the
interaction model. A new shell can consume the same session and transport API.
See `ui/README.md` for registration examples.

## State and events

`SessionService` separates model history from display messages. Only display
messages cross the HTTP boundary. Model continuation blobs and credentials stay
in the backend. SSE delivers snapshots, text deltas, tool starts, status, and
errors. Reconnection restores completed messages; transient partial text is not
a durable event log.

The memory session is intentionally a replaceable first implementation.
Designing a durable event schema, context migrations, and interruption recovery
should be a separate architectural step after this prototype.
