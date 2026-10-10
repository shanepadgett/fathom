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

defmodule Fathom.UI.RightSidebar do
  @moduledoc "Right sidebar content; the shell shows one. Value: `%{label:, view:}`."
  use Fathom.Registry
end
