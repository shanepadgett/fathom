defmodule FathomLlm.Providers do
  @moduledoc "LLM providers by id. Value: `%{provider: module}` implementing `FathomLlm.Provider`."
  use Fathom.Registry

  def provider(id) do
    case get(id) do
      %{value: %{provider: provider}} -> provider
      nil -> nil
    end
  end
end
