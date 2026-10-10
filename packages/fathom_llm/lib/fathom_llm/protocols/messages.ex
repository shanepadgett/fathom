defmodule FathomLlm.Protocols.Messages do
  @moduledoc """
  Anthropic's Messages API, streaming text.

  The endpoint is `%{base_url:, headers:}` plus an optional `system`: content
  blocks the provider puts before any system prompt in the request.
  """
  alias FathomLlm.Protocols.TextStream

  @max_output_tokens 2048
  @failed "Provider could not finish the response. Check model access and account limits."

  def stream(%{base_url: base_url, headers: headers} = endpoint, request, reply_to, ref) do
    body =
      %{
        model: request.model,
        max_tokens: @max_output_tokens,
        stream: true,
        messages: [%{role: "user", content: request.prompt}]
      }
      |> put_system(Map.get(endpoint, :system, []))

    TextStream.stream(base_url <> "/messages", headers, body, &decode/1, reply_to, ref)
  end

  defp put_system(body, []), do: body
  defp put_system(body, blocks), do: Map.put(body, :system, blocks)

  defp decode(%{"type" => "error", "error" => %{"message" => message}})
       when is_binary(message),
       do: {:error, message}

  defp decode(%{"type" => "error"}), do: {:error, @failed}
  defp decode(%{"error" => error}) when error != nil, do: {:error, @failed}

  defp decode(%{
         "type" => "content_block_delta",
         "delta" => %{"type" => "text_delta", "text" => text}
       }),
       do: {:ok, %{text: text}}

  defp decode(%{"type" => "message_stop"}), do: {:ok, %{done: true}}
  defp decode(_frame), do: {:ok, %{}}
end
