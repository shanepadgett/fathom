# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

Code.require_file("../bundled_plugins.exs", __DIR__)

# Plugin applications the kernel may start. They are loaded, not started, at
# boot; the kernel starts each once its requirements are available.
config :fathom, plugins: Fathom.BundledPlugins.apps()

# Fathom's own libraries. Local plugins that name them get the shipped copy.
config :fathom, libraries: Fathom.BundledPlugins.libraries()

config :fathom,
  generators: [timestamp_type: :utc_datetime]

# Configure the endpoint
config :fathom, FathomWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: FathomWeb.ErrorHTML, json: FathomWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Fathom.PubSub,
  live_view: [signing_salt: "sGLhkqiR"]

# Configure LiveView
config :phoenix_live_view,
  # the attribute set on all root tags. Used for Phoenix.LiveView.ColocatedCSS.
  root_tag_attribute: "phx-r"

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.28.2",
  fathom: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    # Colocated hooks compile under _build, so bare imports resolve through
    # NODE_PATH: Hex packages, colocated manifests, and assets/node_modules.
    env: %{
      "NODE_PATH" =>
        Enum.join(
          [
            Path.expand("../deps", __DIR__),
            Mix.Project.build_path(),
            Path.expand("../assets/node_modules", __DIR__)
          ],
          ":"
        )
    }
  ]

# Configure tailwind (the version is required). Fathom.Plugins.Tailwind pins
# the same version, with checksums, for local plugin CSS.
config :tailwind,
  version: "4.3.3",
  fathom: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__),
    env: %{
      "NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()],
      "FATHOM_PHOSPHOR_ICONS" => Path.expand("../deps/phosphor_icons/assets/regular", __DIR__)
    }
  ]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
