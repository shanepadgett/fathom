defmodule FathomAgentRuntime.Session do
  @moduledoc """
  One session: its record, its model, and at most one run.

  The session owns the record. The run (`FathomAgentRuntime.Loop`) sends
  reply fragments and entries here; the session appends entries, saves the
  file, and broadcasts. Fragments are coalesced for 40 ms so a fast
  stream does not flood the chat with one message per token.
  """
  use GenServer, restart: :transient

  alias FathomAgentRuntime.{Loop, Store}

  @flush_ms 40
  @output_limit 32_000
  @empty_partial %{text: "", thinking: "", calls: []}

  def start_link(session),
    do: GenServer.start_link(__MODULE__, session, name: via(session.id))

  def via(id), do: {:via, Registry, {FathomAgentRuntime.Registry, id}}

  @impl true
  def init(session) do
    entries = close_open_calls(session.entries, "Fathom stopped before this tool call finished.")

    state =
      Map.merge(session, %{
        entries: entries,
        status: :idle,
        partial: nil,
        running: %{},
        task: nil,
        ref: nil,
        buffer: [],
        flush: nil,
        seq: 0
      })

    if entries != session.entries, do: Store.save(state)
    {:ok, state}
  end

  @impl true
  def handle_call(:summary, _from, state), do: {:reply, summary(state), state}

  def handle_call(:snapshot, _from, state) do
    state = flush(state)

    snapshot =
      state
      |> summary()
      |> Map.merge(Map.take(state, [:entries, :partial, :running, :seq]))

    {:reply, snapshot, state}
  end

  def handle_call({:prompt, _text}, _from, %{status: :running} = state),
    do: {:reply, {:error, "The agent is already working. Stop it first."}, state}

  def handle_call({:prompt, text}, _from, state) do
    state =
      state
      |> append(%{role: :user, content: text})
      |> then(&if(&1.title == "New chat", do: %{&1 | title: title(text)}, else: &1))
      |> start_run()

    sessions_changed()
    {:reply, :ok, state}
  end

  def handle_call(:abort, _from, %{status: :running} = state) do
    Process.exit(state.task.pid, :kill)
    Process.demonitor(state.task.ref, [:flush])
    {:reply, :ok, finish(state, "Stopped.", false)}
  end

  def handle_call(:abort, _from, state), do: {:reply, :ok, state}

  def handle_call({:set_model, provider, model}, _from, state) do
    state = touch(%{state | provider: provider, model: model})
    Store.save(state)
    sessions_changed()
    {:reply, :ok, state}
  end

  @impl true
  def handle_info({{:llm, ref}, event}, %{ref: ref} = state) do
    state =
      case event do
        {:text, text} -> update_partial(state, :text, &(&1 <> text))
        {:thinking, text} -> update_partial(state, :thinking, &(&1 <> text))
        {:tool_call, call} -> update_partial(state, :calls, &(&1 ++ [call]))
      end

    {:noreply, buffer(state, event)}
  end

  def handle_info({:tool_output, id, fragment}, %{running: running} = state)
      when is_map_key(running, id) do
    state = update_in(state.running[id], &tail(&1 <> fragment))
    {:noreply, buffer(state, {:tool_output, id, fragment})}
  end

  def handle_info({:loop, ref, {:tool_start, id}}, %{ref: ref} = state) do
    state = state |> flush() |> publish({:tool_start, id})
    {:noreply, put_in(state.running[id], "")}
  end

  def handle_info({:loop, ref, {:entry, entry}}, %{ref: ref} = state) do
    entry =
      case entry do
        %{role: :assistant} -> Map.put(entry, :thinking, nonempty(state.partial[:thinking]))
        _ -> entry
      end

    state = flush(state)

    state =
      case entry do
        %{role: :assistant} ->
          %{state | partial: nil}

        %{role: :tool_result, tool_call_id: id} ->
          %{state | running: Map.delete(state.running, id)}

        _ ->
          state
      end

    {:noreply, append(state, entry)}
  end

  def handle_info({ref, :ok}, %{task: %{ref: ref}} = state) do
    Process.demonitor(ref, [:flush])
    {:noreply, finish(state, nil, false)}
  end

  def handle_info({:DOWN, ref, :process, _pid, reason}, %{task: %{ref: ref}} = state),
    do: {:noreply, finish(state, "The run failed: " <> Exception.format_exit(reason), true)}

  def handle_info(:flush, state), do: {:noreply, flush(%{state | flush: nil})}

  # Late messages from a run that was stopped.
  def handle_info(_message, state), do: {:noreply, state}

  defp start_run(state) do
    ref = make_ref()

    ctx = %{
      session: self(),
      ref: ref,
      id: state.id,
      cwd: state.cwd,
      provider: state.provider,
      model: state.model,
      entries: state.entries
    }

    task = Task.Supervisor.async_nolink(FathomAgentRuntime.TaskSupervisor, Loop, :run, [ctx])
    state = %{state | status: :running, task: task, ref: ref, partial: @empty_partial}
    publish(state, {:status, :running})
  end

  # Ends the run: keeps a partial reply, answers open tool calls, and notes why.
  defp finish(state, reason, error?) do
    state = flush(state)

    state =
      case state.partial do
        %{text: text} when text != "" ->
          append(state, %{
            role: :assistant,
            content: [%{type: :text, text: text}],
            provider: state.provider,
            model: state.model,
            native: nil,
            thinking: nonempty(state.partial.thinking),
            usage: nil
          })

        _ ->
          state
      end

    closed =
      close_open_calls(
        state.entries,
        "The person stopped the run before this tool call finished."
      )

    added = Enum.drop(closed, length(state.entries))
    state = Enum.reduce(added, state, &append(&2, &1))

    state =
      if reason, do: append(state, %{role: :notice, content: reason, error: error?}), else: state

    state = %{state | status: :idle, task: nil, ref: nil, partial: nil, running: %{}}
    state = publish(state, {:status, :idle})
    sessions_changed()
    state
  end

  defp append(state, entry) do
    state = touch(%{state | entries: state.entries ++ [entry]})
    Store.save(state)
    publish(state, {:entry, entry})
  end

  @doc false
  # Every tool call needs a result before the next request.
  def close_open_calls(entries, reason) do
    answered = for %{role: :tool_result, tool_call_id: id} <- entries, into: MapSet.new(), do: id

    open =
      for %{role: :assistant, content: content} <- entries,
          %{type: :tool_call, id: id, name: name} <- content,
          not MapSet.member?(answered, id),
          do: %{
            role: :tool_result,
            tool_call_id: id,
            name: name,
            content: reason,
            error: true,
            details: %{},
            duration_ms: nil
          }

    entries ++ open
  end

  defp update_partial(%{partial: nil} = state, key, fun),
    do: update_partial(%{state | partial: @empty_partial}, key, fun)

  defp update_partial(state, key, fun), do: update_in(state.partial[key], fun)

  defp buffer(state, event) do
    flush = state.flush || Process.send_after(self(), :flush, @flush_ms)
    %{state | buffer: [event | state.buffer], flush: flush}
  end

  # Sends buffered fragments, merged per kind and call, in arrival order.
  defp flush(%{buffer: []} = state), do: state

  defp flush(state) do
    if state.flush, do: Process.cancel_timer(state.flush)

    state.buffer
    |> Enum.reverse()
    |> Enum.chunk_by(fn
      {:tool_output, id, _} -> {:tool_output, id}
      {kind, _} -> kind
    end)
    |> Enum.flat_map(fn
      [{:tool_output, id, _} | _] = chunk ->
        [{:tool_output, id, Enum.map_join(chunk, &elem(&1, 2))}]

      [{:tool_call, _} | _] = calls ->
        calls

      [{kind, _} | _] = chunk ->
        [{kind, Enum.map_join(chunk, &elem(&1, 1))}]
    end)
    |> Enum.reduce(%{state | buffer: [], flush: nil}, &publish(&2, &1))
  end

  defp summary(state),
    do: Map.take(state, [:id, :title, :cwd, :provider, :model, :status, :created_at, :updated_at])

  defp touch(state), do: %{state | updated_at: System.system_time(:millisecond)}

  defp title(text) do
    line = text |> String.trim() |> String.split("\n", parts: 2) |> hd()
    if String.length(line) > 60, do: String.slice(line, 0, 57) <> "…", else: line
  end

  defp tail(text) when byte_size(text) > @output_limit,
    do:
      binary_part(text, byte_size(text) - @output_limit, @output_limit)
      |> String.replace_invalid()

  defp tail(text), do: text

  defp nonempty(""), do: nil
  defp nonempty(text), do: text

  defp publish(state, event) do
    seq = state.seq + 1
    Fathom.Events.broadcast("agent:session:" <> state.id, {:agent, state.id, seq, event})
    %{state | seq: seq}
  end

  defp sessions_changed,
    do: Fathom.Events.broadcast("agent:sessions", {:agent_sessions, :changed})
end
