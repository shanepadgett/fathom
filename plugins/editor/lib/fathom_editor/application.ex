defmodule FathomEditor.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {DynamicSupervisor, name: FathomEditor.LanguageServers, strategy: :one_for_one},
      FathomEditor.Tabs,
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomEditor.Plugin}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: FathomEditor.Supervisor)
  end
end
