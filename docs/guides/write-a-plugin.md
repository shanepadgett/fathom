# Write a plugin

This guide rebuilds `examples/counter`: a stored count, a settings page that
increments it, and a configurable step. Every piece is ordinary OTP and
LiveView; Fathom adds a manifest and a publisher.

## 1. Generate

In Fathom, open Settings › Plugins and press **New plugin**. The plugin is
created in `~/.fathom/plugins/counter/`, built, and started; it appears in
the list marked Local. Open the folder in your editor.

From a checkout of this repository, a bundled plugin goes under `plugins/`
instead:

```bash
mise run new -- counter --ui settings
```

Either way the generator runs `mix new --sup`, then adds the manifest, the
publisher at the end of the supervision tree, a context module, and a
settings view. A local plugin names `{:fathom_sdk, "~> 0.1"}`; Fathom builds
it against its own SDK. Restart `mise run dev` after generating a bundled
plugin so the host compiles the new project.

## 2. Declare what the plugin needs

`lib/counter/plugin.ex` is the manifest. The counter stores its value, so it
requires `Fathom.Storage`, provided by the storage plugin. The kernel starts
the counter only once storage runs, and stops it first if storage stops.

```elixir
use Fathom.Plugin,
  otp_app: :counter,
  id: "counter",
  requires: [Fathom.Storage, Fathom.UI.SettingsSections],
  config: [step: [type: :pos_integer, default: 1, doc: "How much each click adds."]]

@impl true
def contributions do
  [{Fathom.UI.SettingsSections, "counter",
    %{label: "Counter", icon: "ph-plus", order: 50, view: CounterWeb.SettingsLive}}]
end
```

The `config` schema is `NimbleOptions`. Settings › Plugins renders a form from
it, validates input before restarting the plugin, and rolls back if the new
configuration fails to start. Read it with `Counter.Plugin.config()`.

## 3. Own the state in one process

Two clicks at once must not lose an increment, so one GenServer owns the
count and serializes changes (`lib/counter/server.ex`). It goes in the
supervision tree before the publisher:

```elixir
children = [Counter.Server, {Fathom.Plugin.Publisher, Counter.Plugin}]
```

## 4. Expose a context

`lib/counter.ex` is the public API. Views, other plugins, and IEx call it;
nothing reaches into `Counter.Server` directly.

```elixir
defdelegate count(), to: Counter.Server
defdelegate increment(), to: Counter.Server
def subscribe, do: Fathom.Events.subscribe("counter")
```

Document the messages `subscribe/0` delivers (`{:counter, count}`) in the
moduledoc. If other plugins should be able to replace this behavior, make the
context a service contract with `use Fathom.Service` and dispatch through
`Fathom.Service.call/3`.

## 5. Render a view

`lib/counter_web/settings_live.ex` is a LiveView rendered nested inside the
settings screen, in its own process:

```elixir
use Fathom.UI, :live_view

def mount(_params, _session, socket) do
  if connected?(socket), do: Counter.subscribe()
  {:ok, assign(socket, count: Counter.count())}
end
```

Use `Fathom.UI.Components` (`settings_section`, `card`, `setting_row`,
`button`, and the rest) so the page matches `design/`.

## 6. Iterate

Edit and save as much as you like; Fathom notices and the workspace header
shows "1 plugin changed · Reload". Press it when you are done. Fathom
compiles the plugin and loads it into the running app, in about two seconds:
views re-render with their state intact, and a plugin whose manifest,
contributions, or application module changed restarts under the new
definition.

Compile errors and warnings appear under Local plugins in Settings ›
Plugins, with file and line; the previous build keeps running until the
error is fixed. A plugin that crashes on start shows the reason and starts
again on the next Reload.

Add Hex packages to `deps` in `mix.exs` as usual. Packages Fathom already
ships resolve to Fathom's versions, and a requirement that conflicts with
them fails with Hex's explanation. Packages with precompiled NIFs, such as
those built with `rustler_precompiled`, work without a compiler. Tailwind
classes in `lib/` are built into the plugin stylesheet.

Local plugins cannot ship JavaScript hooks yet.

For a bundled plugin, `mise run dev:browser` gives you IEx inside the running app:

```elixir
iex> Counter.increment()
iex> Fathom.KernelControl.plugins() |> Enum.map(&{&1.id, &1.state})
```
