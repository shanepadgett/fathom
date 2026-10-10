defmodule Counter do
  @moduledoc """
  The counter context: a stored count that the settings page increments.

  Subscribers to `subscribe/0` receive `{:counter, count}` after each change.
  """
  @topic "counter"

  defdelegate count(), to: Counter.Server
  defdelegate increment(), to: Counter.Server

  def subscribe, do: Fathom.Events.subscribe(@topic)

  @doc false
  def broadcast(count), do: Fathom.Events.broadcast(@topic, {:counter, count})
end
