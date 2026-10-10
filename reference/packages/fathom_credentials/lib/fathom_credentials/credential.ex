defmodule FathomCredentials.Credential do
  @moduledoc """
  A saved credential: an API key or OAuth tokens. Secrets never appear in
  `inspect/1` output or logs.
  """
  @derive {Inspect, only: [:kind, :expires_at, :account_id]}
  @enforce_keys [:kind]
  defstruct [:kind, :key, :access_token, :refresh_token, :expires_at, :account_id]

  @type kind :: :api_key | :oauth

  @type t :: %__MODULE__{
          kind: kind(),
          key: String.t() | nil,
          access_token: String.t() | nil,
          refresh_token: String.t() | nil,
          expires_at: integer() | nil,
          account_id: String.t() | nil
        }

  def api_key(key), do: %__MODULE__{kind: :api_key, key: key}

  def oauth(fields), do: struct!(__MODULE__, [kind: :oauth] ++ Enum.to_list(fields))

  @doc "The bearer secret for request headers."
  def secret(%__MODULE__{kind: :api_key, key: key}), do: key
  def secret(%__MODULE__{kind: :oauth, access_token: token}), do: token

  @doc false
  def to_json(%__MODULE__{kind: :api_key, key: key}), do: %{"kind" => "api-key", "key" => key}

  def to_json(%__MODULE__{kind: :oauth} = c) do
    %{
      "kind" => "oauth",
      "accessToken" => c.access_token,
      "refreshToken" => c.refresh_token,
      "expiresAt" => c.expires_at
    }
    |> then(&if(c.account_id, do: Map.put(&1, "accountId", c.account_id), else: &1))
  end

  @doc false
  def from_json(%{"kind" => "api-key", "key" => key}) when is_binary(key) and key != "",
    do: {:ok, api_key(key)}

  def from_json(
        %{
          "kind" => "oauth",
          "accessToken" => access,
          "refreshToken" => refresh,
          "expiresAt" => expires
        } = json
      )
      when is_binary(access) and is_binary(refresh) and is_number(expires) do
    {:ok,
     oauth(
       access_token: access,
       refresh_token: refresh,
       expires_at: trunc(expires),
       account_id: json["accountId"]
     )}
  end

  def from_json(_), do: :error
end
