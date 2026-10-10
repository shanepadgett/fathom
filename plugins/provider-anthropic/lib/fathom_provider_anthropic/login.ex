defmodule FathomProviderAnthropic.Login do
  @moduledoc """
  Sign in with Claude, paste a code from Claude, or use an API key.

  Browser sign-in listens on a loopback callback, the way Claude Code does,
  and still accepts a pasted callback URL. Paste sign-in uses Anthropic's
  hosted callback page, which shows a `code#state` to paste into Fathom.
  """
  @behaviour FathomCredentials.LoginFlow

  alias FathomCredentials.{Credential, LoginUI, OAuth}
  alias FathomProviderAnthropic.ClaudeCode

  @loopback "http://localhost:53692/callback"
  @hosted "https://platform.claude.com/oauth/code/callback"

  @impl true
  def provider, do: "anthropic"

  @impl true
  def label, do: "Anthropic"

  @impl true
  def methods,
    do: [
      %{id: "browser", label: "Sign in with Claude"},
      %{id: "paste", label: "Paste a code from Claude"},
      %{id: "api-key", label: "Use API key"}
    ]

  defp oauth(redirect_uri \\ @loopback) do
    %OAuth.Config{
      client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
      authorize_url: "https://claude.ai/oauth/authorize",
      token_url: "https://platform.claude.com/v1/oauth/token",
      redirect_uri: redirect_uri,
      scope: ClaudeCode.scope(),
      format: :json,
      extra: %{"code" => "true"}
    }
  end

  @impl true
  def login("browser", ui), do: OAuth.login(oauth(), ui, :loopback)
  def login("paste", ui), do: OAuth.login(oauth(@hosted), ui, :paste)

  def login("api-key", ui) do
    with {:ok, key} <- LoginUI.prompt(ui, "Anthropic API key"),
         do: {:ok, Credential.api_key(String.trim(key))}
  end

  @impl true
  def refresh(credential), do: OAuth.refresh(oauth(), credential)
end
