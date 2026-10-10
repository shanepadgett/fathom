defmodule FathomCodingTools.Truncate do
  @moduledoc "Keeps tool output within what a model should read at once."

  @max_lines 2000
  @max_bytes 50 * 1024

  def max_lines, do: @max_lines
  def max_bytes, do: @max_bytes

  @doc "The first lines of `lines` within the limits, and whether any were cut."
  @spec head([String.t()]) :: {[String.t()], boolean()}
  def head(lines), do: keep(lines, false)

  @doc "The last lines of `text` within the limits, and whether any were cut."
  @spec tail(String.t()) :: {String.t(), boolean()}
  def tail(text) do
    {kept, cut?} = text |> String.split("\n") |> Enum.reverse() |> keep(false)
    {kept |> Enum.reverse() |> Enum.join("\n"), cut?}
  end

  defp keep(lines, cut?), do: keep(lines, [], 0, 0, cut?)

  defp keep([], acc, _count, _bytes, cut?), do: {Enum.reverse(acc), cut?}

  defp keep([line | rest], acc, count, bytes, _cut?) do
    size = byte_size(line) + 1

    if count >= @max_lines or bytes + size > @max_bytes,
      do: {Enum.reverse(acc), true},
      else: keep(rest, [line | acc], count + 1, bytes + size, rest != [])
  end
end
