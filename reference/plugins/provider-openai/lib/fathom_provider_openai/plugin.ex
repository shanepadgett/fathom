defmodule FathomProviderOpenAI.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_provider_openai,
    id: "provider-openai",
    requires: [FathomLlm.Providers, FathomCredentials.Logins]

  @impl true
  def contributions do
    [
      {FathomLlm.Providers, "openai", %{provider: FathomProviderOpenAI}},
      {FathomCredentials.Logins, "openai", %{flow: FathomProviderOpenAI.Login}}
    ]
  end
end
