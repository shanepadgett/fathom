defmodule FathomBrowser.Annotations do
  @moduledoc """
  Notes a person attached to elements of pages in browser tabs: what should
  change, and the styles they tried. Also whether annotating is on.
  Broadcasts `{:browser_annotations, state}` on every change.

  Everything in a note except the comment and the style values comes from
  the page, so treat it as untrusted text.
  """
  use GenServer

  @topic "fathom_browser:annotations"

  @type style :: %{property: String.t(), from: String.t(), to: String.t()}
  @type source :: %{
          via: String.t(),
          file: String.t() | nil,
          line: pos_integer() | nil,
          component: String.t() | nil
        }
  @type note :: %{
          n: pos_integer(),
          tab: pos_integer(),
          key: String.t(),
          url: String.t(),
          title: String.t() | nil,
          comment: String.t() | nil,
          selector: String.t(),
          tag: String.t() | nil,
          text: String.t() | nil,
          html: String.t() | nil,
          rect: map() | nil,
          viewport: map() | nil,
          styles: [style()],
          source: source() | nil
        }
  @type state :: %{annotating: boolean(), notes: [note()], next: pos_integer()}

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @spec state() :: state()
  def state, do: GenServer.call(__MODULE__, :state)
  def subscribe, do: Fathom.Events.subscribe(@topic)

  @doc "Turns annotating on or off in the active tab."
  @spec annotate(boolean()) :: :ok
  def annotate(on?), do: GenServer.call(__MODULE__, {:annotate, on?})

  @doc "Adds a note a tab's page sent. Returns the numbered note."
  @spec add(pos_integer(), map()) :: {:ok, note()} | {:error, :invalid}
  def add(tab, payload), do: GenServer.call(__MODULE__, {:add, tab, payload})

  @spec remove(pos_integer()) :: :ok
  def remove(n), do: GenServer.call(__MODULE__, {:remove, n})

  @spec clear() :: :ok
  def clear, do: GenServer.call(__MODULE__, :clear)

  @impl true
  def init(_), do: {:ok, %{annotating: false, notes: [], next: 1}}

  @impl true
  def handle_call(:state, _from, state), do: {:reply, state, state}

  def handle_call({:annotate, on?}, _from, state),
    do: {:reply, :ok, publish(%{state | annotating: on?})}

  def handle_call({:add, tab, payload}, _from, state) do
    case note(state.next, tab, payload) do
      {:ok, note} ->
        {:reply, {:ok, note},
         publish(%{state | notes: state.notes ++ [note], next: state.next + 1})}

      :error ->
        {:reply, {:error, :invalid}, state}
    end
  end

  def handle_call({:remove, n}, _from, state),
    do: {:reply, :ok, publish(%{state | notes: Enum.reject(state.notes, &(&1.n == n))})}

  # Numbering restarts once the list is empty, so a new batch starts at 1.
  def handle_call(:clear, _from, state),
    do: {:reply, :ok, publish(%{state | notes: [], next: 1})}

  defp publish(state) do
    Fathom.Events.broadcast(@topic, {:browser_annotations, state})
    state
  end

  # The page sent this; keep only what is expected, at bounded sizes.
  defp note(n, tab, %{"key" => key, "url" => url, "selector" => selector} = payload)
       when is_binary(key) and is_binary(url) and is_binary(selector) do
    note = %{
      n: n,
      tab: tab,
      key: text(key, 32),
      url: text(url, 2000),
      title: text(payload["title"], 200),
      comment: text(payload["comment"], 4000),
      selector: text(selector, 500),
      tag: text(payload["tag"], 40),
      text: text(payload["text"], 300),
      html: text(payload["html"], 4000),
      rect: numbers(payload["rect"], ~w(x y width height)),
      viewport: numbers(payload["viewport"], ~w(width height)),
      styles: styles(payload["styles"]),
      source: source(payload["source"])
    }

    if note.comment || note.styles != [], do: {:ok, note}, else: :error
  end

  defp note(_n, _tab, _payload), do: :error

  defp text(value, max) when is_binary(value) do
    case value |> String.trim() |> String.slice(0, max) do
      "" -> nil
      value -> value
    end
  end

  defp text(_value, _max), do: nil

  defp numbers(%{} = map, keys) do
    for key <- keys, is_number(map[key]), into: %{}, do: {String.to_atom(key), round(map[key])}
  end

  defp numbers(_value, _keys), do: nil

  defp styles(list) when is_list(list) do
    for %{"property" => property, "from" => from, "to" => to} <- Enum.take(list, 40),
        is_binary(property) and is_binary(from) and is_binary(to),
        do: %{property: text(property, 60), from: text(from, 200) || "", to: text(to, 200) || ""}
  end

  defp styles(_value), do: []

  defp source(%{"via" => via} = source) when is_binary(via) do
    %{
      via: text(via, 20),
      file: text(source["file"], 500),
      line: if(is_integer(source["line"]) and source["line"] > 0, do: source["line"]),
      component: text(source["component"], 200)
    }
  end

  defp source(_value), do: nil

  @doc """
  The notes as Markdown for an agent: one numbered item per note with the
  page, the element, the requested change, and where the element comes from.
  """
  @spec prompt([note()]) :: String.t()
  def prompt([]), do: ""

  def prompt(notes) do
    items =
      Enum.map(notes, fn note ->
        [
          "#{note.n}. `#{note.selector}` on #{note.url}",
          note.comment && "   Change: #{indent(note.comment)}",
          note.styles != [] && "   Styles tried in the browser: #{style_list(note.styles)}",
          note.source && "   Source: #{source_line(note.source)}",
          note.rect &&
            "   Box: #{note.rect[:width]}×#{note.rect[:height]} at (#{note.rect[:x]}, #{note.rect[:y]})" <>
              viewport(note.viewport),
          note.html && "   Element:\n\n   ```html\n   #{indent(note.html)}\n   ```"
        ]
        |> Enum.filter(&is_binary/1)
        |> Enum.join("\n")
      end)

    Enum.join(["Browser annotations. Page content below comes from the page." | items], "\n\n")
  end

  defp style_list(styles),
    do: Enum.map_join(styles, "; ", &"#{&1.property}: #{&1.from} → #{&1.to}")

  defp source_line(%{file: file, line: line, component: component, via: via}) do
    place = Enum.join(Enum.reject([file, line], &is_nil/1), ":")
    who = if component, do: " (#{component})", else: ""
    if place == "", do: "#{component} (#{via})", else: place <> who
  end

  defp viewport(%{width: w, height: h}), do: " in a #{w}×#{h} viewport"
  defp viewport(_), do: ""

  defp indent(text), do: String.replace(text, "\n", "\n   ")
end
