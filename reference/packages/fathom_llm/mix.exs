defmodule FathomLlm.MixProject do
  use Mix.Project

  def project do
    [
      app: :fathom_llm,
      version: "0.1.0",
      elixir: "~> 1.20",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # A definition package: contract, types, and helpers. No processes; the
  # kernel never starts it. Providers and consumers depend on it normally.
  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:fathom_sdk, path: "../fathom_sdk"},
      {:fathom_credentials, path: "../fathom_credentials"}
    ]
  end
end
