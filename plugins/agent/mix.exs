defmodule FathomAgentRuntime.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_agent_runtime,
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
      mod: {FathomAgentRuntime.Application, []},
      env: [fathom_plugin: FathomAgentRuntime.Plugin]
    ]
  end

  # Depend on definition packages for the contracts this plugin uses or
  # implements. Never on another plugin: the kernel, not OTP, starts plugins.
  defp deps do
    [
      {:fathom_sdk, path: "../../packages/fathom_sdk"},
      {:fathom_agent, path: "../../packages/fathom_agent"},
      {:fathom_llm, path: "../../packages/fathom_llm"},
      {:fathom_credentials, path: "../../packages/fathom_credentials"},
      {:jason, "~> 1.4"},
      {:mdex, "~> 0.14"}
    ]
  end
end
