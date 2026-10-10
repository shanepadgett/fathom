defmodule FathomCredentialsLocal do
  @moduledoc """
  Credentials kept in `auth.json` in the Fathom home: the bundled
  implementation of `FathomCredentials`, plus the connection management its
  settings page uses.

  Subscribers to `subscribe/0` receive `{:credentials, :changed}` and
  `{:credentials_local, {:login, %LoginState{}}}` as logins progress. Neither
  carries secrets.
  """
  @behaviour FathomCredentials

  alias FathomCredentials.{Credential, Logins}
  alias FathomCredentialsLocal.{Access, Sessions, Store}

  @logins_topic "credentials_local:logins"

  @impl true
  defdelegate get(provider), to: Access

  @impl true
  def providers do
    for %{value: %{flow: flow}} <- Logins.entries() do
      credential = Store.get(flow.provider())

      %{
        id: flow.provider(),
        label: flow.label(),
        methods: flow.methods(),
        connected: credential != nil,
        kind: credential && credential.kind,
        expires_at: credential && credential.expires_at
      }
    end
  end

  defdelegate logins(), to: Sessions, as: :list
  defdelegate start_login(provider, method), to: Sessions, as: :start
  defdelegate reply(login_id, value), to: Sessions
  defdelegate cancel(login_id), to: Sessions

  @doc "Saves an API key for `provider`."
  def connect_api_key(provider, key) do
    case String.trim(key) do
      "" ->
        {:error, "Paste an API key"}

      key ->
        with :ok <- Store.put(provider, Credential.api_key(key)), do: FathomCredentials.changed()
    end
  end

  @doc "Opens a waiting login's sign-in page in the system browser."
  def open(login_id) do
    with {:ok, url} <- Sessions.url(login_id), do: Fathom.Environment.open_external(url)
  end

  @doc "Signs out of `provider`, cancelling any login in progress."
  defdelegate remove(provider), to: Access

  def subscribe do
    :ok = FathomCredentials.subscribe()
    Fathom.Events.subscribe(@logins_topic)
  end

  @doc false
  def publish_login(login) do
    Fathom.Events.broadcast(@logins_topic, {:credentials_local, {:login, login}})
    :ok
  end
end
