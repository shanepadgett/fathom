# Plugin standards

Read this when changing anything under `plugins/` or `examples/`.

## Shape

- Generate new plugins with `mise run new -- <id>`. Do not hand-write the
  project; extend the generator if every plugin needs something new.
- One OTP application per plugin. Its supervision tree ends with
  `{Fathom.Plugin.Publisher, X.Plugin}` so nothing is published before the
  processes behind it run.
- The root module (`lib/x.ex`) is the context: the public API other plugins
  and the plugin's own views call. Processes and internals live under `X.*`;
  LiveViews under `XWeb.*`.
- The manifest (`X.Plugin`) lists every token the plugin requires or
  provides. Contributing to a registry requires its token.

## Contracts

- A service contract is a module with `use Fathom.Service`: a behaviour,
  plus client functions that call `Fathom.Service.call/3`.
- A contract other plugins use or might replace lives in a definition
  package under `packages/` (`mix new packages/<name>`), with its structs,
  registry tokens, provider behaviours, and pure helpers. Definitions run no
  processes and depend only on `fathom_sdk` and other definitions.
- The provider plugin's root module implements the behaviour and is
  registered in `services/0`. Its management functions, used only by its own
  views, stay in the plugin.
- The definition owns its event topic: `subscribe/0` and the broadcast
  helper providers call. Events specific to one provider use that provider's
  own topic.
- Arguments and results are plain data and pids. Never pass anonymous
  functions through a contract; stream by sending `{tag, event}` messages to
  a pid the caller supplies.
- Document every message a `subscribe/0` delivers in the context's moduledoc.
- Registry values are maps. Put `:order` on entries that render in a list.

## Dependencies

- Depend on definition packages like any library. Never depend on another
  plugin; if you need its API, that API belongs in a definition package.
- Bundled plugins may use the host's libraries (Phoenix, LiveView, Req,
  Jason, NimbleOptions, Bandit, Ecto). Anything else needs a reason in the
  plugin's README, because a second version of a library cannot load on the
  host node.

## Processes

- One process owns each piece of state. Serialize writes through it.
- Long or cancellable work runs as a task under the plugin's
  `Task.Supervisor`; cancel by stopping the task, not by checking flags.
- Never block a GenServer on a call back into a process that may call it.
  Store data through its owner directly instead of round-tripping.
- Secrets never appear in `inspect/1`, logs, events, or UI state. Derive
  `Inspect` with `only:` on structs that hold them.

## UI

- Views use `use Fathom.UI, :live_view` and controls from
  `Fathom.UI.Components`. Match `design/` before inventing a control; add
  missing controls to the SDK, not to a plugin.
- Use `assign_registry/3` for registry-backed lists so views stay current.
- Write icon classes in full (`"ph-plugs"`).
- Use `start_async/3` for calls that wait on the network.
