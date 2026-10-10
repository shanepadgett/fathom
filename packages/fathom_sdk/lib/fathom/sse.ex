defmodule Fathom.SSE do
  @moduledoc """
  An incremental Server-Sent Events parser. Feed it body chunks; it returns
  complete events. No JSON decoding, no reconnects.

      {events, parser} = Fathom.SSE.parse(Fathom.SSE.new(), chunk)
  """

  @max_buffer 4 * 1024 * 1024

  defstruct buffer: "", event: "message", data: [], id: nil

  @type t :: %__MODULE__{}
  @type event :: %{event: String.t(), data: String.t(), id: String.t() | nil}

  @spec new() :: t()
  def new, do: %__MODULE__{}

  @doc "Parses a chunk. Raises if one frame grows beyond 4 MiB."
  @spec parse(t(), binary()) :: {[event()], t()}
  def parse(%__MODULE__{} = parser, chunk) do
    buffer = parser.buffer <> chunk

    if byte_size(buffer) > @max_buffer, do: raise("SSE frame too large")

    {lines, rest} = split_lines(buffer)

    {events, parser} =
      Enum.reduce(lines, {[], %{parser | buffer: ""}}, fn line, {events, parser} ->
        case line(parser, line) do
          {nil, parser} -> {events, parser}
          {event, parser} -> {[event | events], parser}
        end
      end)

    {Enum.reverse(events), %{parser | buffer: rest}}
  end

  # A trailing "\r" may be the first half of "\r\n", so it waits for more input.
  defp split_lines(buffer) do
    parts = String.split(buffer, ~r/\r\n|\n|\r(?!$)/)
    {lines, [rest]} = Enum.split(parts, -1)
    {lines, rest}
  end

  defp line(%{data: []} = parser, ""), do: {nil, reset(parser)}

  defp line(parser, "") do
    event = %{
      event: parser.event,
      data: parser.data |> Enum.reverse() |> Enum.join("\n"),
      id: parser.id
    }

    {event, reset(parser)}
  end

  defp line(parser, ":" <> _comment), do: {nil, parser}

  defp line(parser, line) do
    {field, value} =
      case String.split(line, ":", parts: 2) do
        [field, " " <> value] -> {field, value}
        [field, value] -> {field, value}
        [field] -> {field, ""}
      end

    case field do
      "data" -> {nil, %{parser | data: [value | parser.data]}}
      "event" -> {nil, %{parser | event: value}}
      "id" -> {nil, %{parser | id: value}}
      _ -> {nil, parser}
    end
  end

  defp reset(parser), do: %{parser | event: "message", data: [], id: nil}
end
