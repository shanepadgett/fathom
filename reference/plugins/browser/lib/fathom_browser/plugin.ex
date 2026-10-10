defmodule FathomBrowser.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_browser,
    id: "browser",
    requires: [Fathom.UI.Docks],
    provides: []

  @impl true
  def contributions do
    [
      {Fathom.UI.Docks, "browser",
       %{label: "Browser", icon: "ph-globe", order: 10, view: FathomBrowserWeb.BrowserLive}}
    ]
  end
end
