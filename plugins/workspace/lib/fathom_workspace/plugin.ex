defmodule FathomWorkspace.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_workspace,
    id: "workspace",
    requires: [
      Fathom.UI.AppShell,
      Fathom.UI.Pages,
      Fathom.UI.SettingsSections,
      Fathom.UI.HeaderActions,
      Fathom.UI.StatusItems,
      Fathom.UI.LeftSidebar,
      Fathom.UI.RightSidebar
    ]

  @impl true
  def contributions do
    [
      {Fathom.UI.AppShell, "shell", %{view: FathomWorkspaceWeb.ShellLive}},
      {Fathom.UI.SettingsSections, "general",
       %{
         label: "General",
         icon: "ph-sliders-horizontal",
         order: 0,
         view: FathomWorkspaceWeb.GeneralLive
       }}
    ]
  end
end
