defmodule FathomAgentRuntime.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Registry, keys: :unique, name: FathomAgentRuntime.Registry},
      {Task.Supervisor, name: FathomAgentRuntime.TaskSupervisor},
      {DynamicSupervisor, name: FathomAgentRuntime.Sessions, strategy: :one_for_one},
      FathomAgentRuntime.Loader,
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomAgentRuntime.Plugin}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: FathomAgentRuntime.Supervisor)
  end
end
