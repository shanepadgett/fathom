defmodule Fathom.UI.CodeReload do
  @moduledoc """
  Re-renders plugin views after the harness swaps plugin code in place.

  Every `use Fathom.UI, :live_view` view mounts this hook. It subscribes the
  view to `topic/0`; the harness broadcasts LiveView's own reload message
  there, and LiveView re-renders the view with the new code and its current
  state.
  """
  import Phoenix.LiveView, only: [connected?: 1]

  @topic "fathom:code"

  @doc false
  def topic, do: @topic

  @doc false
  def on_mount(:default, _params, _session, socket) do
    if connected?(socket), do: Fathom.Events.subscribe(@topic)
    {:cont, socket}
  end
end
