defmodule FathomCodingTools.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomCodingTools.Plugin}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: FathomCodingTools.Supervisor)
  end
end
