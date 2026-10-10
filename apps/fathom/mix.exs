Code.require_file("bundled_plugins.exs", __DIR__)

defmodule Fathom.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader],
      releases: releases()
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Fathom.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:phoenix, "~> 1.8.15"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.2.0"},
      {:lazy_html, ">= 0.1.0", only: :test},
      {:phoenix_live_dashboard, "~> 0.9"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:tailwind, "~> 0.5", runtime: Mix.env() == :dev},
      {:phosphor_icons,
       github: "phosphor-icons/core",
       tag: "v2.0.8",
       sparse: "assets/regular",
       app: false,
       compile: false,
       depth: 1},
      {:fathom_sdk, path: "../../packages/fathom_sdk"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:jason, "~> 1.2"},
      {:bandit, "~> 1.12"},
      # Watches local plugin sources in the shipped app.
      {:file_system, "~> 1.1"}
    ] ++ plugin_deps()
  end

  # Plugins compile with the host but never start at boot: runtime: false
  # keeps OTP from starting them, and the release only loads them. The
  # kernel starts each when its requirements are available.
  defp plugin_deps do
    for {app, path} <- Fathom.BundledPlugins.list(), do: {app, path: path, runtime: false}
  end

  defp releases do
    # Mix and inets ship loaded, not started, so the app can build plugins
    # that bring Hex dependencies.
    plugins = for app <- Fathom.BundledPlugins.apps(), do: {app, :load}

    [
      fathom: [
        applications: [mix: :load, inets: :load] ++ plugins,
        strip_beams: false,
        steps: [:assemble, &strip_beams/1, &copy_icons/1]
      ]
    ]
  end

  # Strips every module except consolidated protocols, which keep their debug
  # info: local plugins that implement a protocol consolidate it again.
  defp strip_beams(release) do
    for beam <- Path.wildcard(Path.join(release.path, "lib/*/ebin/*.beam")) do
      {:ok, binary} = Mix.Release.strip_beam(File.read!(beam))
      File.write!(beam, binary)
    end

    release
  end

  # Local plugin CSS is built inside the app, so the icons ship with it.
  defp copy_icons(release) do
    sdk = Path.wildcard(Path.join(release.path, "lib/fathom_sdk-*")) |> hd()
    File.mkdir_p!(Path.join(sdk, "priv/icons"))
    File.cp_r!("deps/phosphor_icons/assets/regular", Path.join(sdk, "priv/icons/phosphor"))
    release
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "assets.setup", "assets.build"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["compile", "tailwind fathom", "esbuild fathom"],
      "assets.deploy": [
        "tailwind fathom --minify",
        "esbuild fathom --minify",
        "phx.digest"
      ],
      precommit: ["compile --warnings-as-errors", "deps.unlock --unused", "format", "test"]
    ]
  end
end
