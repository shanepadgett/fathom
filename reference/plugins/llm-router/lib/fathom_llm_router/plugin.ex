defmodule FathomLlmRouter.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_llm_router,
    id: "llm-router",
    requires: [FathomCredentials, Fathom.UI.SettingsSections],
    provides: [FathomLlm, FathomLlm.Providers]

  @impl true
  def services, do: [{FathomLlm, FathomLlmRouter}]

  @impl true
  def contributions do
    [
      {Fathom.UI.SettingsSections, "diagnostics",
       %{
         label: "Model diagnostics",
         icon: "ph-robot",
         order: 90,
         view: FathomLlmRouterWeb.DiagnosticsLive
       }}
    ]
  end
end
