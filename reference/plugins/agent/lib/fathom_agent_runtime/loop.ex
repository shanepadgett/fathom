defmodule FathomAgentRuntime.Loop do
  @moduledoc """
  One run: stream a reply, run the tools it calls, and repeat until the
  model answers without calling a tool.

  Runs in a task the session owns. Reply fragments go straight to the
  session (it is `reply_to` for `FathomLlm.stream/3`, tagged with the run
  reference); everything else arrives as `{:loop, ref, event}`:
  `{:entry, entry}` and `{:tool_start, call_id}`. Stopping the run kills
  this process, the HTTP request, and any running command.
  """

  alias FathomAgentRuntime.Prompt

  @max_steps 200

  @type context :: %{
          session: pid(),
          ref: reference(),
          id: String.t(),
          cwd: Path.t(),
          provider: String.t(),
          model: String.t(),
          entries: [map()]
        }

  @spec run(context()) :: :ok
  def run(ctx) do
    modules = FathomAgent.Tools.modules()
    tools = Map.new(modules, &{&1.name(), &1})

    request = %{
      provider: ctx.provider,
      model: ctx.model,
      system: Prompt.system(ctx.cwd, modules),
      tools: Enum.map(modules, &spec/1),
      cache_key: ctx.id
    }

    step(ctx, request, tools, conversation(ctx.entries), 1)
  end

  @doc "The entries the model sees."
  def conversation(entries),
    do: Enum.filter(entries, &(&1.role in [:user, :assistant, :tool_result]))

  defp spec(tool),
    do: %{name: tool.name(), description: tool.description(), parameters: tool.parameters()}

  defp step(ctx, _request, _tools, _messages, step) when step > @max_steps,
    do: notice(ctx, "Stopped after #{@max_steps} model requests in one run.", true)

  defp step(ctx, request, tools, messages, step) do
    case FathomLlm.stream(Map.put(request, :messages, messages), ctx.session, {:llm, ctx.ref}) do
      {:ok, response} ->
        assistant = %{
          role: :assistant,
          content: response.content,
          provider: ctx.provider,
          model: ctx.model,
          native: response.native,
          usage: response.usage
        }

        emit(ctx, {:entry, assistant})

        case FathomLlm.tool_calls(response.content) do
          [] ->
            if response.stop == :length,
              do: notice(ctx, "The reply reached the model's output limit.", true),
              else: :ok

          calls ->
            results = Enum.map(calls, &call(ctx, tools, &1))
            step(ctx, request, tools, messages ++ [assistant | results], step + 1)
        end

      {:error, message} ->
        notice(ctx, message, true)
    end
  end

  defp call(ctx, tools, call) do
    emit(ctx, {:tool_start, call.id})
    started = System.monotonic_time(:millisecond)
    tool_context = %{cwd: ctx.cwd, session: ctx.id, call_id: call.id, reply_to: ctx.session}

    outcome =
      case tools[call.name] do
        nil ->
          {:error,
           "Tool #{call.name} is not available. Available: #{Enum.join(Map.keys(tools), ", ")}"}

        tool ->
          try do
            tool.run(call.arguments, tool_context)
          rescue
            exception -> {:error, "Tool failed: " <> Exception.message(exception)}
          end
      end

    {error?, content, details} =
      case outcome do
        {:ok, %{content: content} = result} -> {false, content, result[:details] || %{}}
        {:error, %{content: content} = result} -> {true, content, result[:details] || %{}}
        {:error, message} when is_binary(message) -> {true, message, %{}}
        other -> {true, "Tool returned #{inspect(other, limit: 5)}", %{}}
      end

    result = %{
      role: :tool_result,
      tool_call_id: call.id,
      name: call.name,
      content: content,
      error: error?,
      # Kept as JSON so live and reloaded sessions look the same.
      details: details |> Jason.encode!() |> Jason.decode!(),
      duration_ms: System.monotonic_time(:millisecond) - started
    }

    emit(ctx, {:entry, result})
    result
  end

  defp notice(ctx, text, error?),
    do: emit(ctx, {:entry, %{role: :notice, content: text, error: error?}})

  defp emit(ctx, event), do: send(ctx.session, {:loop, ctx.ref, event})
end
