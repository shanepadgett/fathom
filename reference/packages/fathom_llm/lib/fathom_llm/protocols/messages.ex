defmodule FathomLlm.Protocols.Messages do
  @moduledoc """
  Anthropic's Messages API, streaming text and tool calls.

  The endpoint is `%{base_url:, headers:}` plus optional:

    * `system`: content blocks the provider puts before the system prompt
    * `tool_name`: renames a tool on the way out; replies are matched back
      to the request's tools without regard to case
  """
  alias FathomLlm.Protocols.Stream

  @max_output_tokens 16_384
  @failed "Provider could not finish the response. Check model access and account limits."
  @ephemeral %{type: "ephemeral"}

  def stream(%{base_url: base_url, headers: headers} = endpoint, request, reply_to, ref) do
    rename = Map.get(endpoint, :tool_name, & &1)
    tools = Map.get(request, :tools, [])

    body =
      %{
        model: request.model,
        max_tokens: @max_output_tokens,
        stream: true,
        messages: request.messages |> messages(rename) |> cache_last()
      }
      |> put_system(Map.get(endpoint, :system, []), request[:system])
      |> put_tools(tools, rename)

    names = Map.new(tools, &{String.downcase(&1.name), &1.name})
    step = &step(&1, &2, names)

    acc = %{blocks: %{}, stop: :stop, usage: %{input: 0, output: 0}}

    with {:ok, acc} <-
           Stream.run(base_url <> "/messages", headers, body, step, acc, reply_to, ref) do
      content =
        acc.blocks
        |> Enum.sort_by(&elem(&1, 0))
        |> Enum.flat_map(fn {_index, block} -> part(block) end)

      {:ok, %{content: content, stop: acc.stop, usage: acc.usage, native: nil}}
    end
  end

  defp put_system(body, [], nil), do: body

  defp put_system(body, blocks, system) do
    prompt = if system, do: [%{type: "text", text: system, cache_control: @ephemeral}], else: []
    Map.put(body, :system, blocks ++ prompt)
  end

  defp put_tools(body, [], _rename), do: body

  defp put_tools(body, tools, rename) do
    Map.put(
      body,
      :tools,
      Enum.map(tools, fn tool ->
        %{name: rename.(tool.name), description: tool.description, input_schema: tool.parameters}
      end)
    )
  end

  # Tool results that follow one another go back in one user message.
  defp messages(messages, rename) do
    messages
    |> Enum.chunk_by(&(&1.role == :tool_result))
    |> Enum.flat_map(fn
      [%{role: :tool_result} | _] = results ->
        [%{role: "user", content: Enum.map(results, &tool_result/1)}]

      others ->
        Enum.flat_map(others, &message(&1, rename))
    end)
  end

  defp message(%{role: :user, content: content}, _rename),
    do: [%{role: "user", content: [%{type: "text", text: content}]}]

  defp message(%{role: :assistant, content: content}, rename) do
    blocks =
      Enum.flat_map(content, fn
        %{type: :text, text: text} when text != "" ->
          [%{type: "text", text: text}]

        %{type: :tool_call, id: id, name: name, arguments: arguments} ->
          [%{type: "tool_use", id: tool_id(id), name: rename.(name), input: arguments}]

        _ ->
          []
      end)

    if blocks == [], do: [], else: [%{role: "assistant", content: blocks}]
  end

  defp tool_result(result) do
    %{
      type: "tool_result",
      tool_use_id: tool_id(result.tool_call_id),
      content: result.content,
      is_error: result.error
    }
  end

  # Other providers' call ids may use characters Anthropic rejects.
  defp tool_id(id), do: String.replace(id, ~r/[^a-zA-Z0-9_-]/, "_")

  # Caches the conversation so far; the next request reads it back.
  defp cache_last([]), do: []

  defp cache_last(messages) do
    List.update_at(messages, -1, fn message ->
      Map.update!(message, :content, fn blocks ->
        List.update_at(blocks, -1, &Map.put(&1, :cache_control, @ephemeral))
      end)
    end)
  end

  defp part(%{type: :text, text: text}), do: [%{type: :text, text: text}]

  defp part(%{type: :tool_call} = block),
    do: [%{type: :tool_call, id: block.id, name: block.name, arguments: block.arguments}]

  defp part(_block), do: []

  defp step(%{"type" => "error"} = frame, _acc, _names),
    do: {:error, get_in(frame, ["error", "message"]) || @failed}

  defp step(%{"type" => "message_start", "message" => message}, acc, _names) do
    input = get_in(message, ["usage", "input_tokens"]) || 0
    cached = get_in(message, ["usage", "cache_read_input_tokens"]) || 0
    {:cont, put_in(acc.usage.input, input + cached), []}
  end

  defp step(
         %{"type" => "content_block_start", "index" => index, "content_block" => block},
         acc,
         names
       ) do
    block =
      case block do
        %{"type" => "text"} ->
          %{type: :text, text: ""}

        %{"type" => "tool_use", "id" => id, "name" => name} ->
          name = Map.get(names, String.downcase(name), name)
          %{type: :tool_call, id: id, name: name, json: "", arguments: %{}}

        %{"type" => type} ->
          %{type: type}
      end

    {:cont, put_in(acc.blocks[index], block), []}
  end

  defp step(%{"type" => "content_block_delta", "index" => index, "delta" => delta}, acc, _names) do
    case delta do
      %{"type" => "text_delta", "text" => text} ->
        {:cont, update_in(acc.blocks[index].text, &(&1 <> text)), [{:text, text}]}

      %{"type" => "input_json_delta", "partial_json" => json} ->
        {:cont, update_in(acc.blocks[index].json, &(&1 <> json)), []}

      %{"type" => "thinking_delta", "thinking" => text} ->
        {:cont, acc, [{:thinking, text}]}

      _ ->
        {:cont, acc, []}
    end
  end

  defp step(%{"type" => "content_block_stop", "index" => index}, acc, _names) do
    case acc.blocks[index] do
      %{type: :tool_call, json: json} = block ->
        block = %{block | arguments: Stream.arguments(json)}
        call = Map.take(block, [:id, :name, :arguments])
        {:cont, put_in(acc.blocks[index], block), [{:tool_call, call}]}

      _ ->
        {:cont, acc, []}
    end
  end

  defp step(%{"type" => "message_delta"} = frame, acc, _names) do
    stop =
      case get_in(frame, ["delta", "stop_reason"]) do
        "tool_use" -> :tool_use
        "max_tokens" -> :length
        _ -> acc.stop
      end

    output = get_in(frame, ["usage", "output_tokens"]) || acc.usage.output
    {:cont, %{acc | stop: stop, usage: %{acc.usage | output: output}}, []}
  end

  defp step(%{"type" => "message_stop"}, acc, _names), do: {:done, acc, []}
  defp step(_frame, acc, _names), do: {:cont, acc, []}
end
