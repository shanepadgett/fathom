defmodule FathomAgentRuntime.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_agent_runtime,
    id: "agent",
    requires: [FathomLlm, FathomCredentials, Fathom.Storage, Fathom.UI.Pages],
    provides: [FathomAgent, FathomAgent.Tools]

  @impl true
  def services, do: [{FathomAgent, FathomAgentRuntime}]

  @impl true
  def contributions do
    [
      {Fathom.UI.Pages, "chat",
       %{label: "Chat", icon: "ph-chat-circle", order: 0, view: FathomAgentRuntimeWeb.ChatLive}}
    ]
  end
end
