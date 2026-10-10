defmodule Counter.MixProject do
  use Mix.Project

  def project do
    [
      app: :counter,
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
      mod: {Counter.Application, []},
      env: [fathom_plugin: Counter.Plugin]
    ]
  end

  # Depend on other plugins with runtime: false; the kernel starts them.
  defp deps do
    [
      {:fathom_sdk, path: "../../packages/fathom_sdk"}
    ]
  end
end
