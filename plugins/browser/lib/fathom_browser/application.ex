defmodule FathomBrowser.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      FathomBrowser.Tabs,
      FathomBrowser.Annotations,
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomBrowser.Plugin}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: FathomBrowser.Supervisor)
  end
end
