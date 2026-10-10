defmodule FathomBrowser.Tabs do
  @moduledoc """
  The open tabs. A tab without a URL is a new tab waiting for an address.
  Broadcasts `{:browser_tabs, state}` on every change.
  """
  use GenServer

  @topic "fathom_browser:tabs"

  @type tab :: %{
          id: pos_integer(),
          url: String.t() | nil,
          title: String.t() | nil,
          loading: boolean()
        }
  @type state :: %{tabs: [tab()], active: pos_integer() | nil, next: pos_integer()}

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @spec state() :: state()
  def state, do: GenServer.call(__MODULE__, :state)
  def subscribe, do: Fathom.Events.subscribe(@topic)

  @spec open(String.t() | nil) :: pos_integer()
  def open(url \\ nil), do: GenServer.call(__MODULE__, {:open, url})
  def close(id), do: GenServer.call(__MODULE__, {:close, id})
  def activate(id), do: GenServer.call(__MODULE__, {:activate, id})
  def navigate(id, url), do: GenServer.call(__MODULE__, {:navigate, id, url})
  def loaded(id, url, loading?), do: GenServer.call(__MODULE__, {:loaded, id, url, loading?})
  def titled(id, title), do: GenServer.call(__MODULE__, {:titled, id, title})

  @impl true
  def init(_), do: {:ok, add(%{tabs: [], active: nil, next: 1}, nil)}

  @impl true
  def handle_call(:state, _from, state), do: {:reply, state, state}

  def handle_call({:open, url}, _from, state) do
    state = add(state, url)
    {:reply, state.active, publish(state)}
  end

  def handle_call({:close, id}, _from, state) do
    index = Enum.find_index(state.tabs, &(&1.id == id)) || 0
    tabs = Enum.reject(state.tabs, &(&1.id == id))

    state =
      cond do
        tabs == [] -> add(%{state | tabs: [], active: nil}, nil)
        state.active == id -> %{state | tabs: tabs, active: Enum.at(tabs, max(index - 1, 0)).id}
        true -> %{state | tabs: tabs}
      end

    {:reply, :ok, publish(state)}
  end

  def handle_call({:activate, id}, _from, state) do
    if Enum.any?(state.tabs, &(&1.id == id)),
      do: {:reply, :ok, publish(%{state | active: id})},
      else: {:reply, :ok, state}
  end

  def handle_call({:navigate, id, url}, _from, state),
    do: {:reply, :ok, publish(update(state, id, &%{&1 | url: url, title: nil, loading: true}))}

  def handle_call({:loaded, id, url, loading?}, _from, state),
    do: {:reply, :ok, publish(update(state, id, &%{&1 | url: url, loading: loading?}))}

  def handle_call({:titled, id, title}, _from, state) do
    title = if title in [nil, ""], do: nil, else: title
    {:reply, :ok, publish(update(state, id, &%{&1 | title: title}))}
  end

  defp add(state, url) do
    tab = %{id: state.next, url: url, title: nil, loading: url != nil}
    %{state | tabs: state.tabs ++ [tab], active: tab.id, next: state.next + 1}
  end

  defp update(state, id, fun),
    do: %{state | tabs: Enum.map(state.tabs, &if(&1.id == id, do: fun.(&1), else: &1))}

  defp publish(state) do
    Fathom.Events.broadcast(@topic, {:browser_tabs, state})
    state
  end
end
