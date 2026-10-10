defmodule FathomProviderXAI.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_provider_xai,
    id: "provider-xai",
    requires: [FathomLlm.Providers, FathomCredentials.Logins]

  @impl true
  def contributions do
    [
      {FathomLlm.Providers, "xai", %{provider: FathomProviderXAI}},
      {FathomCredentials.Logins, "xai", %{flow: FathomProviderXAI.Login}}
    ]
  end
end
