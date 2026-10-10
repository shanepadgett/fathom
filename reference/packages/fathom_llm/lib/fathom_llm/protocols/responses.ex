defmodule FathomLlm.Protocols.Responses do
  @moduledoc """
  The OpenAI Responses API, streaming text and tool calls. Also served by
  the Codex backend and xAI.

  The endpoint is `%{base_url:, headers:, provider:}` plus an optional
  `body` merged into each request (`include`, `reasoning`).

  Requests are stateless (`store: false`). An assistant message's `native`
  holds the response's output items; they go back verbatim to the same
  provider and model, which keeps encrypted reasoning attached to the tool
  calls it led to. Messages from other models are rebuilt from `content`.
  """
  alias FathomLlm.Protocols.Stream

  @failed "Provider could not finish the response. Check model access and account limits."
  @instructions "You are a helpful assistant."

  def stream(%{base_url: base_url, headers: headers} = endpoint, request, reply_to, ref) do
    tools = Map.get(request, :tools, [])
    same = {endpoint.provider, request.model}

    body =
      %{
        model: request.model,
        stream: true,
        store: false,
        instructions: request[:system] || @instructions,
        input: Enum.flat_map(request.messages, &input(&1, same))
      }
      |> put_tools(tools)
      |> put_cache_key(request[:cache_key])
      |> Map.merge(Map.get(endpoint, :body, %{}))

    acc = %{items: [], stop: :stop, usage: nil}

    with {:ok, acc} <-
           Stream.run(base_url <> "/responses", headers, body, &step/2, acc, reply_to, ref) do
      items = Enum.reverse(acc.items)
      content = Enum.flat_map(items, &part/1)
      stop = if Enum.any?(content, &(&1.type == :tool_call)), do: :tool_use, else: acc.stop
      {:ok, %{content: content, stop: stop, usage: acc.usage, native: items}}
    end
  end

  defp put_tools(body, []), do: body

  defp put_tools(body, tools) do
    Map.merge(body, %{
      tools:
        Enum.map(tools, fn tool ->
          %{
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        end),
      tool_choice: "auto",
      parallel_tool_calls: true
    })
  end

  defp put_cache_key(body, nil), do: body
  defp put_cache_key(body, key), do: Map.put(body, :prompt_cache_key, key)

  defp input(%{role: :user, content: text}, _same),
    do: [%{role: "user", content: [%{type: "input_text", text: text}]}]

  defp input(%{role: :assistant, native: [_ | _] = items, provider: p, model: m}, same)
       when {p, m} == same,
       do: items

  defp input(%{role: :assistant, content: content}, _same) do
    Enum.flat_map(content, fn
      %{type: :text, text: text} when text != "" ->
        [%{type: "message", role: "assistant", content: [%{type: "output_text", text: text}]}]

      %{type: :tool_call, id: id, name: name, arguments: arguments} ->
        [%{type: "function_call", call_id: id, name: name, arguments: Jason.encode!(arguments)}]

      _ ->
        []
    end)
  end

  defp input(%{role: :tool_result} = result, _same),
    do: [%{type: "function_call_output", call_id: result.tool_call_id, output: result.content}]

  defp part(%{"type" => "message", "content" => content}) do
    case for(%{"type" => "output_text", "text" => text} <- content, into: "", do: text) do
      "" -> []
      text -> [%{type: :text, text: text}]
    end
  end

  defp part(%{"type" => "function_call", "call_id" => id, "name" => name} = item),
    do: [%{type: :tool_call, id: id, name: name, arguments: Stream.arguments(item["arguments"])}]

  defp part(_item), do: []

  defp step(%{"type" => "response.output_text.delta", "delta" => delta}, acc),
    do: {:cont, acc, [{:text, delta}]}

  defp step(%{"type" => "response.reasoning_summary_text.delta", "delta" => delta}, acc),
    do: {:cont, acc, [{:thinking, delta}]}

  defp step(%{"type" => "response.reasoning_summary_part.done"}, acc),
    do: {:cont, acc, [{:thinking, "\n\n"}]}

  defp step(%{"type" => "response.output_item.done", "item" => item}, acc) do
    events =
      for %{type: :tool_call} = call <- part(item), do: {:tool_call, Map.delete(call, :type)}

    {:cont, %{acc | items: [item | acc.items]}, events}
  end

  defp step(%{"type" => type} = frame, acc)
       when type in ["response.completed", "response.done"] do
    case get_in(frame, ["response", "status"]) do
      status when status in [nil, "completed"] -> {:done, %{acc | usage: usage(frame)}, []}
      _ -> {:error, "Provider response did not complete"}
    end
  end

  defp step(%{"type" => "response.incomplete"} = frame, acc),
    do: {:done, %{acc | stop: :length, usage: usage(frame)}, []}

  defp step(%{"type" => type} = frame, _acc) when type in ["error", "response.failed"],
    do: {:error, get_in(frame, ["response", "error", "message"]) || frame["message"] || @failed}

  defp step(%{"error" => error}, _acc) when error != nil, do: {:error, @failed}
  defp step(_frame, acc), do: {:cont, acc, []}

  defp usage(frame) do
    case get_in(frame, ["response", "usage"]) do
      %{"input_tokens" => input, "output_tokens" => output} -> %{input: input, output: output}
      _ -> nil
    end
  end
end
