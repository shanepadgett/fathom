defmodule FathomProviderXAI.Login do
  @moduledoc "Sign in with SuperGrok or X Premium by device code, or use an API key."
  @behaviour FathomCredentials.LoginFlow

  alias FathomCredentials.{Credential, DeviceCode, LoginUI}

  @impl true
  def provider, do: "xai"

  @impl true
  def label, do: "xAI"

  @impl true
  def methods,
    do: [
      %{id: "device", label: "Sign in with SuperGrok or X Premium"},
      %{id: "api-key", label: "Use API key"}
    ]

  defp oauth do
    %DeviceCode.Config{
      client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      scope: "openid profile email offline_access grok-cli:access api:access",
      device_code_url: "https://auth.x.ai/oauth2/device/code",
      token_url: "https://auth.x.ai/oauth2/token",
      referrer: "fathom",
      refresh_skew_ms: 5 * 60_000
    }
  end

  @impl true
  def login("device", ui), do: DeviceCode.login(oauth(), ui)

  def login("api-key", ui) do
    with {:ok, key} <- LoginUI.prompt(ui, "xAI API key"),
         do: {:ok, Credential.api_key(String.trim(key))}
  end

  @impl true
  def refresh(credential), do: DeviceCode.refresh(oauth(), credential)
end
