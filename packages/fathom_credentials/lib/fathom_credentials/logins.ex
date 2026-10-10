defmodule FathomCredentials.Logins do
  @moduledoc """
  Login flows by provider id. Entry key: the provider id. Value:
  `%{flow: module}` where the module implements `FathomCredentials.LoginFlow`.
  """
  use Fathom.Registry

  @doc "The flow module for `provider`, or nil."
  def flow(provider) do
    case get(provider) do
      %{value: %{flow: flow}} -> flow
      nil -> nil
    end
  end
end
