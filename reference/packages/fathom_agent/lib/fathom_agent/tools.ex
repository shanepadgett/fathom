defmodule FathomAgent.Tools do
  @moduledoc "Tools agents can call, by name. Value: `%{tool: module}` implementing `FathomAgent.Tool`."
  use Fathom.Registry

  @doc "The tool modules contributed now."
  @spec modules() :: [module()]
  def modules, do: for(%{value: %{tool: tool}} <- entries(), do: tool)
end
