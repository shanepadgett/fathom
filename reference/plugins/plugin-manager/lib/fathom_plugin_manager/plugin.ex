defmodule FathomPluginManager.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_plugin_manager,
    id: "plugin-manager",
    requires: [Fathom.KernelControl, Fathom.UI.SettingsSections, Fathom.UI.HeaderActions]

  @impl true
  def contributions do
    [
      {Fathom.UI.SettingsSections, "plugins",
       %{
         label: "Plugins",
         icon: "ph-tree-structure",
         order: 80,
         view: FathomPluginManagerWeb.PluginsLive
       }},
      {Fathom.UI.HeaderActions, "plugin-status",
       %{order: 10, view: FathomPluginManagerWeb.HeaderLive}}
    ]
  end
end
