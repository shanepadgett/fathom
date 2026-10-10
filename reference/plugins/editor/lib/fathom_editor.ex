defmodule FathomEditor do
  @moduledoc """
  The editor context: open files in the current folder (`Fathom.Folder`)
  and edit them in the Editor dock, with language servers.

  Other plugins open files with `Fathom.Folder.open_file/2` and never call
  this plugin. `open/2` is here for IEx and this plugin's views.
  """

  defdelegate state(), to: FathomEditor.Tabs
  defdelegate open(path, line \\ nil), to: FathomEditor.Tabs
  defdelegate close(path), to: FathomEditor.Tabs
end
