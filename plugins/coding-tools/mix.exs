defmodule FathomCodingTools.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_coding_tools,
      version: "0.1.0",
      elixir: "~> 1.20",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # The harness finds the plugin through :fathom_plugin; it never imports it.
  def application do
    [
      extra_applications: [:logger],
      mod: {FathomCodingTools.Application, []},
      env: [fathom_plugin: FathomCodingTools.Plugin]
    ]
  end

  # Depend on definition packages for the contracts this plugin uses or
  # implements. Never on another plugin: the kernel, not OTP, starts plugins.
  defp deps do
    [
      {:fathom_sdk, path: "../../packages/fathom_sdk"},
      {:fathom_agent, path: "../../packages/fathom_agent"}
    ]
  end
end
