defmodule Fathom.Storage do
  @moduledoc """
  Small JSON values per plugin. Provided by the storage plugin.

  Use your plugin id as the namespace. Values must encode as JSON; maps come
  back with string keys.
  """
  use Fathom.Service

  @callback get(namespace :: String.t(), key :: String.t()) :: term() | nil
  @callback put(namespace :: String.t(), key :: String.t(), value :: term()) :: :ok
  @callback delete(namespace :: String.t(), key :: String.t()) :: :ok

  def get(namespace, key), do: Fathom.Service.call(__MODULE__, :get, [namespace, key])

  def put(namespace, key, value),
    do: Fathom.Service.call(__MODULE__, :put, [namespace, key, value])

  def delete(namespace, key), do: Fathom.Service.call(__MODULE__, :delete, [namespace, key])
end
