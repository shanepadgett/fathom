defmodule FathomCredentialsLocal.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_credentials_local,
    id: "credentials-local",
    requires: [Fathom.Environment, Fathom.UI.SettingsSections],
    provides: [FathomCredentials, FathomCredentials.Logins]

  @impl true
  def services, do: [{FathomCredentials, FathomCredentialsLocal}]

  @impl true
  def contributions do
    [
      {Fathom.UI.SettingsSections, "providers",
       %{
         label: "Providers",
         icon: "ph-plugs",
         order: 10,
         view: FathomCredentialsLocalWeb.ProvidersLive
       }}
    ]
  end
end
