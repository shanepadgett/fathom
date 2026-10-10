defmodule Fathom.HTTP do
  @moduledoc """
  Outbound HTTP on `Req` with Fathom's error and retry rules.

  Requests retry HTTP 429, 502, 503, and 504, honoring `retry-after`. Network
  failures are not retried. Pass `retries: 0` for requests unsafe to repeat.
  Cancel a request by stopping the process that makes it.
  """

  defmodule Error do
    @moduledoc """
    A final non-2xx response. The message adds the provider's own error
    message when the body carries one as `error.message` or `message`.
    """
    defexception [:status, :body]

    @impl true
    def message(%{status: status, body: body}) do
      guidance =
        cond do
          status in [401, 403] -> "Check authentication and access permissions."
          status == 429 -> "Rate limit reached. Try again shortly."
          true -> "Check the request and service availability."
        end

      case detail(body) do
        nil -> "Request failed (HTTP #{status}). #{guidance}"
        detail -> "Request failed (HTTP #{status}). #{guidance} Provider said: #{detail}"
      end
    end

    defp detail(%{"error" => %{"message" => message}}) when is_binary(message), do: message
    defp detail(%{"error" => message}) when is_binary(message), do: message
    defp detail(%{"message" => message}) when is_binary(message), do: message
    defp detail(_body), do: nil
  end

  # Error bodies kept from a failed stream, enough for a provider message.
  @max_error_body 64 * 1024

  @retryable [429, 502, 503, 504]

  @doc """
  Sends a request. Takes `Req` options plus `:retries` (default 2). Returns
  the response for 2xx and `Fathom.HTTP.Error` otherwise.
  """
  @spec request(keyword()) :: {:ok, Req.Response.t()} | {:error, Exception.t()}
  def request(opts) do
    {retries, opts} = Keyword.pop(opts, :retries, 2)

    opts
    |> Keyword.merge(
      retry: fn _request, response ->
        match?(%Req.Response{status: s} when s in @retryable, response)
      end,
      max_retries: retries,
      retry_log_level: false
    )
    |> Req.request()
    |> check()
  end

  @doc """
  Sends a request and reduces its Server-Sent Events, like
  `Enum.reduce_while/3`: `fun` returns `{:cont, acc}`, `{:halt, acc}`, or
  `{:error, reason}`. Runs in the calling process; not retried.
  """
  @spec stream_sse(keyword(), acc, (Fathom.SSE.event(), acc ->
                                      {:cont, acc} | {:halt, acc} | {:error, term()})) ::
          {:ok, acc} | {:error, term()}
        when acc: term()
  def stream_sse(opts, acc, fun) do
    into = fn {:data, data}, {request, response} ->
      if response.status in 200..299 do
        {parser, acc} = Req.Response.get_private(response, :fathom_sse, {Fathom.SSE.new(), acc})
        {events, parser} = Fathom.SSE.parse(parser, data)

        case reduce(events, acc, fun) do
          {:cont, acc} ->
            {:cont, {request, put(response, {parser, acc})}}

          {:halt, acc} ->
            {:halt, {request, put(response, {parser, acc})}}

          {:error, reason} ->
            {:halt, {request, Req.Response.put_private(response, :fathom_error, reason)}}
        end
      else
        body = Req.Response.get_private(response, :fathom_error_body, "")

        body =
          if byte_size(body) < @max_error_body,
            do: body <> binary_part(data, 0, min(byte_size(data), @max_error_body)),
            else: body

        {:cont, {request, Req.Response.put_private(response, :fathom_error_body, body)}}
      end
    end

    case opts |> Keyword.merge(into: into, retry: false) |> Req.request() do
      {:ok, %{status: status} = response} when status in 200..299 ->
        case Req.Response.get_private(response, :fathom_error) do
          nil -> {:ok, response |> Req.Response.get_private(:fathom_sse, {nil, acc}) |> elem(1)}
          reason -> {:error, reason}
        end

      {:ok, response} ->
        body = Req.Response.get_private(response, :fathom_error_body, "")

        body =
          case Jason.decode(body) do
            {:ok, decoded} -> decoded
            {:error, _} -> body
          end

        {:error, %Error{status: response.status, body: body}}

      {:error, exception} ->
        {:error, exception}
    end
  end

  defp put(response, state), do: Req.Response.put_private(response, :fathom_sse, state)

  defp reduce([], acc, _fun), do: {:cont, acc}

  defp reduce([event | rest], acc, fun) do
    case fun.(event, acc) do
      {:cont, acc} -> reduce(rest, acc, fun)
      other -> other
    end
  end

  defp check({:ok, %Req.Response{status: status} = response}) when status in 200..299,
    do: {:ok, response}

  defp check({:ok, response}), do: {:error, %Error{status: response.status, body: response.body}}
  defp check({:error, exception}), do: {:error, exception}
end
