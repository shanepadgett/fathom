defmodule FathomEditor.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_editor,
    id: "editor",
    requires: [Fathom.UI.Docks, Fathom.Storage],
    provides: []

  @impl true
  def contributions do
    [
      {Fathom.UI.Docks, "editor",
       %{label: "Editor", icon: "ph-code", order: 20, view: FathomEditorWeb.EditorLive}}
    ]
  end
end
