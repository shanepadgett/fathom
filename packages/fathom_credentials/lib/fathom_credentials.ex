defmodule FathomCredentials do
  @moduledoc """
  The credentials contract: saved provider credentials, for the plugins that
  call providers.

  `get/1` returns a provider's credential, with OAuth tokens refreshed before
  they expire. `providers/0` lists every provider with a login flow and
  whether it is connected, without secrets. Subscribers to `subscribe/0`
  receive `{:credentials, :changed}` when connections change.

  Provider plugins add sign-in by contributing a `FathomCredentials.LoginFlow`
  to `FathomCredentials.Logins`, using `OAuth`, `DeviceCode`, and `LoginUI`.
  The implementation (`fathom_credentials_local` by default) stores
  credentials, runs login flows, and broadcasts with `changed/0`.
  """
  use Fathom.Service

  alias FathomCredentials.Credential

  @type provider_status :: %{
          id: String.t(),
          label: String.t(),
          methods: [%{id: String.t(), label: String.t()}],
          connected: boolean(),
          kind: Credential.kind() | nil,
          expires_at: integer() | nil
        }

  @topic "credentials"

  @callback get(provider :: String.t()) :: {:ok, Credential.t()} | :none | {:error, String.t()}
  @callback providers() :: [provider_status()]

  @doc "The saved credential for `provider`."
  def get(provider), do: Fathom.Service.call(__MODULE__, :get, [provider])

  @doc "Connection status for every provider with a login flow. No secrets."
  def providers, do: Fathom.Service.call(__MODULE__, :providers, [])

  def subscribe, do: Fathom.Events.subscribe(@topic)

  @doc "For implementations: tells subscribers that connections changed."
  def changed do
    Fathom.Events.broadcast(@topic, {:credentials, :changed})
    :ok
  end
end
