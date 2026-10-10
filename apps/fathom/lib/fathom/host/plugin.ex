defmodule Fathom.Host.Plugin do
  @moduledoc """
  The harness, described with the same manifest as a plugin. It provides the
  services every plugin may require and owns the application slots.
  """
  use Fathom.Plugin,
    otp_app: :fathom,
    id: "fathom",
    provides: [
      Fathom.Environment,
      Fathom.KernelControl,
      Fathom.UI.AppShell,
      Fathom.UI.Pages,
      Fathom.UI.SettingsSections,
      Fathom.UI.HeaderActions,
      Fathom.UI.StatusItems,
      Fathom.UI.LeftSidebar,
      Fathom.UI.RightSidebar
    ]

  @impl true
  def services do
    [{Fathom.Environment, Fathom.Host.Environment}, {Fathom.KernelControl, Fathom.Kernel.Control}]
  end
end
