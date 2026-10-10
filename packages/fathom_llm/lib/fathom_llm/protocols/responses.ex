defmodule FathomLlm.Protocols.Responses do
  @moduledoc "The OpenAI Responses API, streaming text. Also served by xAI."
  alias FathomLlm.Protocols.TextStream

  @failed "Provider could not finish the response. Check model access and account limits."

  def stream(
        %{base_url: base_url, headers: headers},
        %{model: model, prompt: prompt},
        reply_to,
        ref
      ) do
    body = %{
      model: model,
      stream: true,
      store: false,
      instructions: "You are a helpful assistant.",
      input: [%{role: "user", content: [%{type: "input_text", text: prompt}]}]
    }

    TextStream.stream(base_url <> "/responses", headers, body, &decode/1, reply_to, ref)
  end

  defp decode(%{"error" => error}) when error != nil, do: {:error, @failed}

  defp decode(%{"type" => type}) when type in ["error", "response.failed", "response.incomplete"],
    do: {:error, @failed}

  defp decode(%{"type" => "response.output_text.delta", "delta" => delta}),
    do: {:ok, %{text: delta}}

  defp decode(%{"type" => type} = frame) when type in ["response.completed", "response.done"] do
    case get_in(frame, ["response", "status"]) do
      status when status in [nil, "completed"] -> {:ok, %{done: true}}
      _ -> {:error, "Provider response did not complete"}
    end
  end

  defp decode(_frame), do: {:ok, %{}}
end
