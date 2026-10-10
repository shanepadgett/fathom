defmodule FathomCredentialsLocal.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Task.Supervisor, name: FathomCredentialsLocal.TaskSupervisor},
      FathomCredentialsLocal.Store,
      FathomCredentialsLocal.Sessions,
      FathomCredentialsLocal.Access,
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomCredentialsLocal.Plugin}
    ]

    # Access calls into Sessions and Store; a crash below restarts what follows.
    opts = [strategy: :rest_for_one, name: FathomCredentialsLocal.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
