defmodule FathomCredentials.LoginFlow do
  @moduledoc """
  Provider-owned authentication. Provider plugins implement this behaviour
  and contribute the module to `FathomCredentials.Logins`:

      {FathomCredentials.Logins, "openai", %{flow: MyProvider.Login}}

  `login/2` runs in its own process; cancelling a login kills it, along with
  anything it linked. Use `FathomCredentials.LoginUI` to show status and ask
  for input. Never put secrets in status messages.
  """
  alias FathomCredentials.{Credential, LoginUI}

  @callback provider() :: String.t()
  @callback label() :: String.t()
  @callback methods() :: [%{id: String.t(), label: String.t()}]
  @callback login(method :: String.t(), LoginUI.t()) ::
              {:ok, Credential.t()} | {:error, String.t()}
  @callback refresh(Credential.t()) :: {:ok, Credential.t()} | {:error, String.t()}

  @optional_callbacks refresh: 1
end
