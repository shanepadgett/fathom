defmodule FathomProviderOpenAI.Login do
  @moduledoc "Sign in with ChatGPT (browser or device code), or use an API key."
  @behaviour FathomCredentials.LoginFlow

  alias FathomCredentials.{Credential, LoginUI, OAuth}

  @impl true
  def provider, do: "openai"

  @impl true
  def label, do: "OpenAI"

  @impl true
  def methods do
    [
      %{id: "browser", label: "Sign in with ChatGPT"},
      %{id: "device", label: "Use device code"},
      %{id: "api-key", label: "Use API key"}
    ]
  end

  @doc false
  def oauth do
    %OAuth.Config{
      client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
      authorize_url: "https://auth.openai.com/oauth/authorize",
      token_url: "https://auth.openai.com/oauth/token",
      redirect_uri: "http://localhost:1455/auth/callback",
      scope: "openid profile email offline_access",
      extra: %{
        "id_token_add_organizations" => "true",
        "codex_cli_simplified_flow" => "true",
        "originator" => "codex_cli_rs"
      },
      account_id: &account_id/1
    }
  end

  @impl true
  def login("browser", ui), do: OAuth.login(oauth(), ui, :loopback)
  def login("device", ui), do: FathomProviderOpenAI.Device.login(oauth(), ui)

  def login("api-key", ui) do
    with {:ok, key} <- LoginUI.prompt(ui, "OpenAI API key"),
         do: {:ok, Credential.api_key(String.trim(key))}
  end

  @impl true
  def refresh(credential), do: OAuth.refresh(oauth(), credential)

  defp account_id(%{access_token: access, id_token: id_token}) do
    claim = "https://api.openai.com/auth"
    auth = OAuth.claims(id_token || access)[claim] || OAuth.claims(access)[claim]

    case auth do
      %{"chatgpt_account_id" => id} when is_binary(id) -> id
      _ -> nil
    end
  end
end
