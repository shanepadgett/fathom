defmodule FathomLlmRouter.Checks do
  @moduledoc """
  Bounded streaming requests for the diagnostics page; not conversations.
  Each check is a task; cancelling kills it. At most 3 run at once and the
  last 30 are kept.

  Subscribers to `subscribe/0` receive `{:llm_check, id, event}` where event
  is `{:text, fragment}`, `:done`, `{:error, message}`, or `:cancelled`.
  """
  use GenServer

  @topic "llm:checks"
  @max_active 3
  @history_limit 30
  @max_text_bytes 1_000_000
  @timeout_ms 5 * 60_000

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def subscribe, do: Fathom.Events.subscribe(@topic)

  @spec start(FathomLlm.request()) :: {:ok, String.t()} | {:error, String.t()}
  def start(request), do: GenServer.call(__MODULE__, {:start, request})
  def cancel(id), do: GenServer.call(__MODULE__, {:cancel, id})

  @impl true
  def init(nil), do: {:ok, %{checks: %{}, order: []}}

  @impl true
  def handle_call({:start, request}, _from, state) do
    if Enum.count(state.checks, fn {_, c} -> c.state == :running end) >= @max_active do
      {:reply, {:error, "Finish or cancel an active model check first"}, state}
    else
      id = Base.url_encode64(:crypto.strong_rand_bytes(9), padding: false)
      server = self()

      # Fragments arrive here as {id, {:text, fragment}}, tagged by check id.
      task =
        Task.Supervisor.async_nolink(FathomLlmRouter.TaskSupervisor, fn ->
          FathomLlm.stream(request, server, id)
        end)

      Process.send_after(self(), {:expire, id}, @timeout_ms)
      check = %{task: task, text: "", state: :running}

      state =
        prune(%{state | checks: Map.put(state.checks, id, check), order: state.order ++ [id]})

      {:reply, {:ok, id}, state}
    end
  end

  def handle_call({:cancel, id}, _from, state), do: {:reply, :ok, finish(state, id, :cancelled)}

  @impl true
  def handle_info({id, {:text, text}}, state) when is_binary(id) do
    case state.checks[id] do
      %{state: :running, text: so_far} = check
      when byte_size(so_far) + byte_size(text) <= @max_text_bytes ->
        publish(id, {:text, text})
        {:noreply, put_in(state.checks[id], %{check | text: so_far <> text})}

      %{state: :running} ->
        {:noreply, finish(state, id, {:error, "Response exceeds the model-check limit"})}

      _ ->
        {:noreply, state}
    end
  end

  def handle_info({ref, result}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])

    case find(state, ref) do
      nil -> {:noreply, state}
      id -> {:noreply, finish(state, id, if(result == :ok, do: :done, else: result))}
    end
  end

  def handle_info({:DOWN, ref, :process, _pid, _reason}, state) do
    case find(state, ref) do
      nil -> {:noreply, state}
      id -> {:noreply, finish(state, id, {:error, "Model request failed"})}
    end
  end

  def handle_info({:expire, id}, state),
    do: {:noreply, finish(state, id, {:error, "Model request timed out"})}

  defp finish(state, id, outcome) do
    case state.checks[id] do
      %{state: :running, task: task} = check ->
        Task.shutdown(task, :brutal_kill)
        publish(id, outcome)
        put_in(state.checks[id], %{check | state: outcome, task: nil})

      _ ->
        state
    end
  end

  defp find(state, ref),
    do: Enum.find_value(state.checks, fn {id, c} -> if c.task && c.task.ref == ref, do: id end)

  defp prune(%{order: order} = state) when length(order) <= @history_limit, do: state

  defp prune(state) do
    case Enum.find(state.order, &(state.checks[&1].state != :running)) do
      nil -> state
      id -> %{state | checks: Map.delete(state.checks, id), order: List.delete(state.order, id)}
    end
  end

  defp publish(id, event), do: Fathom.Events.broadcast(@topic, {:llm_check, id, event})
end
