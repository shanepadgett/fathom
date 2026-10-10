defmodule FathomProviderAnthropic.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_provider_anthropic,
    id: "provider-anthropic",
    requires: [FathomLlm.Providers, FathomCredentials.Logins]

  @impl true
  def contributions do
    [
      {FathomLlm.Providers, "anthropic", %{provider: FathomProviderAnthropic}},
      {FathomCredentials.Logins, "anthropic", %{flow: FathomProviderAnthropic.Login}}
    ]
  end
end
