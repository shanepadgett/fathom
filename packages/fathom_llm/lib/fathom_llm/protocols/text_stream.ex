defmodule FathomLlm.Protocols.TextStream do
  @moduledoc """
  POSTs a JSON body and reads an SSE response of JSON frames. `decode`
  turns a frame into `{:ok, %{text: fragment | nil, done: boolean}}` or
  `{:error, message}`. Each fragment goes to `reply_to` as
  `{tag, {:text, fragment}}`. A stream that ends without a done frame is an
  error.
  """

  @receive_timeout 5 * 60_000

  @spec stream(
          String.t(),
          keyword() | map(),
          map(),
          (map() -> {:ok, map()} | {:error, String.t()}),
          pid(),
          term()
        ) ::
          :ok | {:error, String.t()}
  def stream(url, headers, body, decode, reply_to, ref) do
    opts = [
      method: :post,
      url: url,
      headers: headers,
      json: body,
      receive_timeout: @receive_timeout
    ]

    result =
      Fathom.HTTP.stream_sse(opts, false, fn
        %{data: "[DONE]"}, _done ->
          {:halt, true}

        %{data: data}, done ->
          with {:ok, json} <- decode_json(data),
               {:ok, frame} <- decode.(json) do
            if frame[:text], do: send(reply_to, {ref, {:text, frame.text}})
            if frame[:done], do: {:halt, true}, else: {:cont, done}
          end
      end)

    case result do
      {:ok, true} -> :ok
      {:ok, false} -> {:error, "Provider stream ended before completion"}
      {:error, %{__exception__: true} = exception} -> {:error, Exception.message(exception)}
      {:error, message} -> {:error, message}
    end
  end

  defp decode_json(data) do
    case Jason.decode(data) do
      {:ok, %{} = json} -> {:ok, json}
      _ -> {:error, "Provider stream sent a frame that is not valid JSON"}
    end
  end
end
