defmodule FathomProviderXAI.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomProviderXAI.Plugin}
    ]

    opts = [strategy: :one_for_one, name: FathomProviderXAI.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
