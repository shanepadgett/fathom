defmodule Counter.Server do
  @moduledoc "Owns the count, so concurrent increments never lose one."
  use GenServer

  @namespace "counter"

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def count, do: GenServer.call(__MODULE__, :count)
  def increment, do: GenServer.call(__MODULE__, :increment)

  @impl true
  def init(nil), do: {:ok, Fathom.Storage.get(@namespace, "count") || 0}

  @impl true
  def handle_call(:count, _from, count), do: {:reply, count, count}

  def handle_call(:increment, _from, count) do
    count = count + Counter.Plugin.config().step
    :ok = Fathom.Storage.put(@namespace, "count", count)
    Counter.broadcast(count)
    {:reply, count, count}
  end
end
