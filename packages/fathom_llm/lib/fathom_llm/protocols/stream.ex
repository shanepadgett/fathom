defmodule FathomLlm.Protocols.Stream do
  @moduledoc """
  POSTs a JSON body and folds an SSE response of JSON frames into a result.

  `step.(frame, acc)` returns `{:cont, acc, events}`, `{:done, acc, events}`,
  or `{:error, message}`. Each event goes to `reply_to` as `{tag, event}`.
  A stream that ends without a done frame is an error.
  """

  @receive_timeout 5 * 60_000

  @type step(acc) :: (map(), acc ->
                        {:cont, acc, [term()]} | {:done, acc, [term()]} | {:error, String.t()})

  @spec run(String.t(), keyword() | map(), map(), step(acc), acc, pid(), term()) ::
          {:ok, acc} | {:error, String.t()}
        when acc: term()
  def run(url, headers, body, step, acc, reply_to, tag) do
    opts = [
      method: :post,
      url: url,
      headers: headers,
      json: body,
      receive_timeout: @receive_timeout
    ]

    result =
      Fathom.HTTP.stream_sse(opts, {:open, acc}, fn
        %{data: "[DONE]"}, {_, acc} ->
          {:halt, {:done, acc}}

        %{data: data}, {:open, acc} ->
          with {:ok, json} <- decode_json(data),
               {state, acc, events} when state in [:cont, :done] <- step.(json, acc) do
            Enum.each(events, &send(reply_to, {tag, &1}))
            if state == :done, do: {:halt, {:done, acc}}, else: {:cont, {:open, acc}}
          end

        _event, done ->
          {:halt, done}
      end)

    case result do
      {:ok, {:done, acc}} -> {:ok, acc}
      {:ok, {:open, _acc}} -> {:error, "Provider stream ended before completion"}
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

  @doc "Decodes streamed tool arguments; an empty string is no arguments."
  @spec arguments(String.t()) :: map()
  def arguments(""), do: %{}

  def arguments(json) do
    case Jason.decode(json) do
      {:ok, %{} = arguments} -> arguments
      _ -> %{"_invalid_json" => json}
    end
  end
end
