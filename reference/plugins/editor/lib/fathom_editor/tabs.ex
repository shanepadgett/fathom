defmodule FathomEditor.Tabs do
  @moduledoc """
  Open files, the active one, and unsaved text, kept here so they survive
  the dock's view going away. Watches the current folder and reports
  changes.

  Broadcasts on `"editor"`:

    * `{:editor_tabs, state}` when tabs change
    * `{:editor_open, path, line}` when a file should show, at a line
    * `{:editor_disk, path}` when an open file changed on disk
    * `{:editor_tree, dir}` when a folder's entries changed
    * `{:editor_changed, paths}` for every batch of changed files
  """
  use GenServer

  require Logger

  @topic "editor"
  @tree_debounce_ms 250

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def subscribe, do: Fathom.Events.subscribe(@topic)

  def state, do: GenServer.call(__MODULE__, :state)

  def open(path, line \\ nil),
    do: GenServer.call(__MODULE__, {:open, Fathom.Folder.real(path), line})

  def close(path), do: GenServer.call(__MODULE__, {:close, path})
  def activate(path), do: GenServer.call(__MODULE__, {:activate, path})

  @doc "Keeps unsaved text for `path`, or forgets it with nil."
  def buffer(path, content), do: GenServer.cast(__MODULE__, {:buffer, path, content})

  @impl true
  def init(_) do
    Fathom.Folder.subscribe()

    state = %{
      tabs: [],
      active: nil,
      line: nil,
      buffers: %{},
      root: nil,
      watcher: nil,
      dirs: MapSet.new(),
      paths: MapSet.new(),
      timer: nil
    }

    {:ok, watch(state, Fathom.Folder.current())}
  end

  @impl true
  def handle_call(:state, _from, state), do: {:reply, public(state), state}

  def handle_call({:open, path, line}, _from, state),
    do: {:reply, :ok, open_tab(state, path, line)}

  def handle_call({:close, path}, _from, state) do
    index = Enum.find_index(state.tabs, &(&1.path == path))
    tabs = Enum.reject(state.tabs, &(&1.path == path))

    active =
      cond do
        state.active != path -> state.active
        tabs == [] -> nil
        true -> Enum.at(tabs, max((index || 0) - 1, 0)).path
      end

    state = %{state | tabs: tabs, active: active, buffers: Map.delete(state.buffers, path)}
    {:reply, :ok, publish(state)}
  end

  def handle_call({:activate, path}, _from, state),
    do: {:reply, :ok, publish(%{state | active: path, line: nil})}

  @impl true
  def handle_cast({:buffer, path, nil}, state),
    do: {:noreply, publish(%{state | buffers: Map.delete(state.buffers, path)})}

  def handle_cast({:buffer, path, content}, state) do
    changed? = not Map.has_key?(state.buffers, path)
    state = %{state | buffers: Map.put(state.buffers, path, content)}
    {:noreply, if(changed?, do: publish(state), else: state)}
  end

  @impl true
  def handle_info({:fathom_folder, {:changed, root}}, state), do: {:noreply, watch(state, root)}

  def handle_info({:fathom_folder, {:open_file, path, line}}, state) do
    cond do
      File.dir?(path) ->
        Fathom.Folder.open(path)
        Fathom.UI.Docks.open("editor")
        {:noreply, state}

      File.regular?(path) ->
        Fathom.UI.Docks.open("editor")
        {:noreply, open_tab(state, path, line)}

      true ->
        {:noreply, state}
    end
  end

  def handle_info({:file_event, watcher, {path, events}}, %{watcher: watcher} = state) do
    open? = Enum.any?(state.tabs, &(&1.path == path))

    # Saves arrive as modified, or as created or renamed from an atomic replace.
    if open? and Enum.any?(events, &(&1 in [:modified, :created, :renamed])),
      do: Fathom.Events.broadcast(@topic, {:editor_disk, path})

    if FathomEditor.Files.hidden?(path) do
      {:noreply, state}
    else
      timer = state.timer || Process.send_after(self(), :tree, @tree_debounce_ms)
      dirs = MapSet.put(state.dirs, Path.dirname(path))
      {:noreply, %{state | dirs: dirs, paths: MapSet.put(state.paths, path), timer: timer}}
    end
  end

  def handle_info({:file_event, _watcher, _}, state), do: {:noreply, state}

  def handle_info(:tree, state) do
    Enum.each(state.dirs, &Fathom.Events.broadcast(@topic, {:editor_tree, &1}))
    Fathom.Events.broadcast(@topic, {:editor_changed, MapSet.to_list(state.paths)})
    {:noreply, %{state | dirs: MapSet.new(), paths: MapSet.new(), timer: nil}}
  end

  def handle_info(_message, state), do: {:noreply, state}

  defp open_tab(state, path, line) do
    state =
      if Enum.any?(state.tabs, &(&1.path == path)),
        do: state,
        else: %{
          state
          | tabs: state.tabs ++ [%{path: path, language: FathomEditor.Files.language(path)}]
        }

    # The dock may mount after this broadcast; it reads `line` instead.
    state = publish(%{state | active: path, line: line})
    Fathom.Events.broadcast(@topic, {:editor_open, path, line})
    state
  end

  # Watching a whole home directory is too much; pick a project folder.
  defp watch(%{root: root} = state, root), do: state

  defp watch(state, root) do
    if state.watcher, do: GenServer.stop(state.watcher)

    watcher =
      if root == System.user_home!() do
        nil
      else
        case FileSystem.start_link(dirs: [root]) do
          {:ok, watcher} ->
            FileSystem.subscribe(watcher)
            watcher

          other ->
            Logger.warning("Editor cannot watch #{root}: #{inspect(other)}")
            nil
        end
      end

    %{state | root: root, watcher: watcher}
  end

  defp public(state) do
    tabs = for tab <- state.tabs, do: Map.put(tab, :dirty, Map.has_key?(state.buffers, tab.path))
    %{tabs: tabs, active: state.active, line: state.line, buffers: state.buffers}
  end

  defp publish(state) do
    Fathom.Events.broadcast(@topic, {:editor_tabs, public(state)})
    state
  end
end
