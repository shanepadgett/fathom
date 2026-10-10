import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts. Fathom is a desktop app: it always listens on loopback.

config :fathom, home: System.get_env("FATHOM_HOME") || Path.expand("~/.fathom")

port = String.to_integer(System.get_env("PORT", if(config_env() == :prod, do: "0", else: "4000")))

config :fathom, FathomWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: port],
  check_origin: ["//127.0.0.1", "//localhost"]

# The desktop shell sets FATHOM_DESKTOP. Only the window it opens, carrying
# this per-launch token, gets a session.
if System.get_env("FATHOM_DESKTOP") do
  config :fathom, launch_token: Base.url_encode64(:crypto.strong_rand_bytes(24), padding: false)
  config :fathom, FathomWeb.Endpoint, server: true
end

if System.get_env("PHX_SERVER") do
  config :fathom, FathomWeb.Endpoint, server: true
end

if config_env() == :dev do
  repo = Path.expand("../../..", __DIR__)
  plugin_code = ~r"(plugins|examples)/[^/]+/lib/.*\.(ex|heex)$"E

  config :fathom, FathomWeb.Endpoint,
    live_reload: [
      web_console_logger: true,
      patterns: [
        # Static assets, except user uploads
        ~r"priv/static/(?!uploads/).*\.(js|css|png|jpeg|jpg|gif|svg)$"E,
        # Router and controllers
        ~r"lib/fathom_web/router\.ex$"E,
        ~r"lib/fathom_web/controllers/.*\.(ex|heex)$"E
      ],
      # LiveViews re-render in place, keeping their state, when harness,
      # package, or plugin code changes.
      notify: [
        live_view: [
          ~r"lib/fathom_web/(live|components)/.*\.(ex|heex)$"E,
          ~r"packages/[^/]+/lib/.*\.(ex|heex)$"E,
          plugin_code
        ]
      ]
    ]

  config :phoenix_live_reload, :dirs, [
    "",
    Path.join(repo, "packages"),
    Path.join(repo, "plugins"),
    Path.join(repo, "examples")
  ]
end

if config_env() == :prod do
  # Sessions last one launch, so a fresh secret per launch is enough.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") || Base.encode64(:crypto.strong_rand_bytes(48))

  config :fathom, FathomWeb.Endpoint,
    url: [host: "127.0.0.1", port: port, scheme: "http"],
    secret_key_base: secret_key_base
end
