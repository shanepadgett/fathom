defmodule FathomEditor.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_editor,
      version: "0.1.0",
      elixir: "~> 1.20",
      start_permanent: Mix.env() == :prod,
      # Writes the colocated hook manifest that the host's app.js imports.
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      deps: deps()
    ]
  end

  # The harness finds the plugin through :fathom_plugin; it never imports it.
  def application do
    [
      extra_applications: [:logger],
      mod: {FathomEditor.Application, []},
      env: [fathom_plugin: FathomEditor.Plugin]
    ]
  end

  # Depend on definition packages for the contracts this plugin uses or
  # implements. Never on another plugin: the kernel, not OTP, starts plugins.
  defp deps do
    [
      {:fathom_sdk, path: "../../packages/fathom_sdk"},
      # Shipped by the host, which watches local plugins with it.
      {:file_system, "~> 1.1"},
      {:jason, "~> 1.4"}
    ]
  end
end
