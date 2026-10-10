defmodule Fathom.UI do
  @moduledoc """
  Plugin UI is LiveView. Slot contributions are LiveViews rendered nested in
  the shell, each in its own process.

      defmodule Counter.SettingsLive do
        use Fathom.UI, :live_view

        def render(assigns) do
          ~H\"\"\"
          <.settings_section title="Counter">...</.settings_section>
          \"\"\"
        end
      end

  The session of every contributed view holds `"plugin"`, the contributing
  plugin's id.
  """

  use Phoenix.Component
  import Phoenix.LiveView

  def live_view do
    quote do
      use Phoenix.LiveView
      on_mount Fathom.UI.CodeReload
      unquote(html_helpers())
    end
  end

  def live_component do
    quote do
      use Phoenix.LiveComponent
      unquote(html_helpers())
    end
  end

  def html do
    quote do
      use Phoenix.Component
      unquote(html_helpers())
    end
  end

  defp html_helpers do
    quote do
      import Phoenix.HTML
      import Fathom.UI.Components
      import Fathom.UI, only: [slot_view: 1, assign_registry: 3]
      alias Phoenix.LiveView.JS
    end
  end

  defmacro __using__(which) when is_atom(which), do: apply(__MODULE__, which, [])

  @doc """
  Assigns `key` to the entries of `registry` and keeps it current while the
  LiveView is connected.
  """
  @spec assign_registry(Phoenix.LiveView.Socket.t(), atom(), module()) ::
          Phoenix.LiveView.Socket.t()
  def assign_registry(socket, key, registry) do
    socket = assign(socket, key, Fathom.Registry.entries(registry))

    if connected?(socket) do
      Fathom.Registry.subscribe(registry)
      tracked = Map.get(socket.private, :fathom_registries, %{})
      socket = put_private(socket, :fathom_registries, Map.put(tracked, registry, key))

      if map_size(tracked) == 0 do
        attach_hook(socket, :fathom_registries, :handle_info, &refresh_registry/2)
      else
        socket
      end
    else
      socket
    end
  end

  defp refresh_registry({:fathom_registry, registry}, socket) do
    case socket.private.fathom_registries do
      %{^registry => key} -> {:halt, assign(socket, key, Fathom.Registry.entries(registry))}
      _ -> {:cont, socket}
    end
  end

  defp refresh_registry(_message, socket), do: {:cont, socket}

  @doc """
  Renders registry entries as nested LiveViews.

    * `mode="all"` - every entry, in order.
    * `mode="single"` - the first entry.
    * `mode="keyed"` - the entry whose key is `selected`.

  The `:fallback` slot renders when nothing matches.
  """
  attr :socket, :any, required: true
  attr :entries, :list, required: true
  attr :mode, :string, default: "all", values: ~w(all single keyed)
  attr :selected, :string, default: nil
  attr :session, :map, default: %{}
  slot :fallback

  def slot_view(assigns) do
    assigns = assign(assigns, :shown, shown(assigns.entries, assigns.mode, assigns.selected))

    ~H"""
    <%= for entry <- @shown do %>
      {live_render(@socket, entry.value.view,
        id: view_id(entry),
        session: Map.put(@session, "plugin", entry.plugin)
      )}
    <% end %>
    <%= if @shown == [] do %>
      {render_slot(@fallback)}
    <% end %>
    """
  end

  defp shown(entries, "all", _), do: entries
  defp shown(entries, "single", _), do: Enum.take(entries, 1)
  defp shown(entries, "keyed", key), do: Enum.filter(entries, &(&1.key == key))

  # A restarted plugin has a new publisher, so its views remount instead of
  # rendering with the previous process's state.
  defp view_id(entry) do
    slug = entry.registry |> Module.split() |> List.last() |> Macro.underscore()
    "#{slug}-#{entry.key}-#{:erlang.phash2(entry.owner)}"
  end
end
