defmodule Fathom.UI.AppShell do
  @moduledoc """
  The application shell. The renderer shows the first entry and falls back to
  the recovery panel when there is none. Value: `%{view: live_view}`.
  """
  use Fathom.Registry
end

defmodule Fathom.UI.Pages do
  @moduledoc "Workspace pages. Value: `%{label:, icon:, view:}`."
  use Fathom.Registry
end

defmodule Fathom.UI.SettingsSections do
  @moduledoc "Settings sections. Value: `%{label:, icon:, view:}`."
  use Fathom.Registry
end

defmodule Fathom.UI.HeaderActions do
  @moduledoc "Controls in the workspace header. Value: `%{view:}`."
  use Fathom.Registry
end

defmodule Fathom.UI.StatusItems do
  @moduledoc "Items in the status bar. Value: `%{view:}`."
  use Fathom.Registry
end

defmodule Fathom.UI.LeftSidebar do
  @moduledoc "Left sidebar content; the shell shows one. Value: `%{label:, view:}`."
  use Fathom.Registry
end

defmodule Fathom.UI.Docks do
  @moduledoc """
  Panes docked to the right of the workspace, each opened by a header
  button. The shell keeps a dock's view mounted while it is closed.
  Value: `%{label:, icon:, view:}`.

  Code can open a dock too, so an agent can show what it is doing.
  """
  use Fathom.Registry

  @topic "fathom:docks"

  @doc "Messages: `{:fathom_docks, {:open, key}}` and `{:fathom_docks, :close}`."
  def topic, do: @topic

  @doc "Opens the dock contributed under `key`."
  @spec open(String.t()) :: :ok
  def open(key), do: Fathom.Events.broadcast(@topic, {:fathom_docks, {:open, key}})

  @doc "Closes the open dock."
  @spec close() :: :ok
  def close, do: Fathom.Events.broadcast(@topic, {:fathom_docks, :close})
end

defmodule Fathom.UI.RightSidebar do
  @moduledoc "Right sidebar content; the shell shows one. Value: `%{label:, view:}`."
  use Fathom.Registry
end
