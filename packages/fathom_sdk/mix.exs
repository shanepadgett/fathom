defmodule Fathom.SDK.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_sdk,
      version: "0.1.0",
      elixir: "~> 1.20",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: "Contracts, UI components, and generators for Fathom plugins"
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger, :eex]
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:phoenix_live_view, "~> 1.2.0"},
      {:req, "~> 0.7"},
      {:jason, "~> 1.2"},
      {:nimble_options, "~> 1.1"}
    ]
  end
end
