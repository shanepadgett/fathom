defmodule Counter.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :counter,
    id: "counter",
    requires: [Fathom.Storage, Fathom.UI.SettingsSections],
    config: [step: [type: :pos_integer, default: 1, doc: "How much each click adds."]],
    enabled: false

  @impl true
  def contributions do
    [
      {Fathom.UI.SettingsSections, "counter",
       %{label: "Counter", icon: "ph-plus", order: 50, view: CounterWeb.SettingsLive}}
    ]
  end
end
