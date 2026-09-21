# Concepts

Six words cover the SDK. The first three are enough for most plugins.

**Plugin.** A directory with a `deno.json` and up to two entries: `backend`
runs in the Deno process, `ui` runs in the page. Each entry exports
`definePlugin({ id, requires, provides, start })`. Everything a plugin registers
during `start` is released when it stops, so the common case needs no cleanup.

**Contract.** The tokens and schemas a plugin exports for others, by convention
in `contract.ts` and exported as `@scope/<id>/contract`. A contract holds no
runtime state. Tokens match by their string id, so a second copy of the SDK or
an inlined UI bundle still interoperates.

**Service.** One provider, many consumers. `defineService<T>("id")` declares
it; a plugin lists it in `provides` and returns the value from `start`, or lists
it in `requires` and receives it on the start context under the same key. A
service can be a factory that receives the consumer's scope.

**Registry.** One owner, many contributors. `defineRegistry<E>("id")` declares
it; the owner lists it in `provides` and receives the registry on the start
context; contributors list it in `requires` and call `add`. Entries carry the
contributing plugin's id and are removed with it.

**Slot.** A registry of UI contributions that the shell renders. The SDK owns
the application slots: `AppShell`, `Pages`, `SettingsSections`,
`HeaderActions`, `StatusItems`, `LeftSidebar`, `RightSidebar`. A page plugin
contributes `{ label, icon, component }`.

**Scope.** Present on every start context. `scope.defer(fn)` registers cleanup;
`scope.task(work)` tracks background work for shutdown; `scope.signal` aborts
when the plugin is stopping. Advanced: `scope.handoff(schema, produce)` carries
state across a reload.

## Two runtimes, one API surface

The backend entry imports `@fathom/sdk`. The UI entry imports `@fathom/sdk` for
plugin definition and `@fathom/sdk/ui` for slots, the client, appearance, and
controls. An API declared with `defineApi` is served on the backend with
`api.serve(Token, handlers)` and required on the UI side by listing the same
token in `requires`; the page receives a typed client whose inputs and outputs
are validated on both sides.

## What the kernel guarantees

- A plugin starts only after every `requires` token is available, and reports
  `blocked` with the missing ids until then.
- Withdrawing a service stops its consumers; restoring it starts them again.
- Configuration is validated against the plugin's `config` schema before the
  running instance stops. Failed activation restores the previous generation.
- Registry leases hold a contributor's shutdown open until admitted work ends.
