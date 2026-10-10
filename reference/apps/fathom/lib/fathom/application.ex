defmodule Fathom.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      FathomWeb.Telemetry,
      {Phoenix.PubSub, name: Fathom.PubSub},
      # Plugin publishers register here; entries end with their owner.
      {Registry, keys: :unique, name: Fathom.Service.registry()},
      {Registry, keys: :duplicate, name: Fathom.Registry.registry()},
      {Fathom.Plugin.Publisher, Fathom.Host.Plugin},
      plugins(Application.fetch_env!(:fathom, :home)),
      # Start to serve requests, typically the last entry
      FathomWeb.Endpoint,
      Fathom.Host.Launch
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Fathom.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Local plugins live in the kernel; a kernel restart takes the local
  # plugin loader with it, so it hands them over again.
  defp plugins(home) do
    children = [
      {Fathom.Kernel, home: home, apps: Application.fetch_env!(:fathom, :plugins)},
      {Fathom.Plugins.Local, home: home}
    ]

    %{
      id: Fathom.PluginSupervisor,
      type: :supervisor,
      start:
        {Supervisor, :start_link,
         [children, [strategy: :rest_for_one, name: Fathom.PluginSupervisor]]}
    }
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    FathomWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
