# fathom (host)

The Fathom harness: the plugin kernel (`lib/fathom/kernel*`), the harness
services and slots (`lib/fathom/host`), and the renderer root
(`lib/fathom_web/live/app_live.ex`). Generated with `mix phx.new`.

Run it from the repository root with `mise run dev` or `mise run dev:browser`.
`bundled_plugins.exs` lists the plugin projects under `plugins/` and
`examples/`; `mix.exs` compiles them, `config/config.exs` hands them to the
kernel, and `config/dev.exs` reloads them. See
[architecture](../../docs/architecture.md).
