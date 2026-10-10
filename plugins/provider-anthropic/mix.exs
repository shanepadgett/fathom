defmodule FathomProviderAnthropic.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_provider_anthropic,
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
      mod: {FathomProviderAnthropic.Application, []},
      env: [fathom_plugin: FathomProviderAnthropic.Plugin]
    ]
  end

  # Depend on other plugins with runtime: false; the kernel starts them.
  defp deps do
    [
      {:fathom_sdk, path: "../../packages/fathom_sdk"},
      {:fathom_credentials, path: "../../packages/fathom_credentials"},
      {:fathom_llm, path: "../../packages/fathom_llm"}
    ]
  end
end
