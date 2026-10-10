defmodule FathomCodingTools.Edit do
  @moduledoc """
  The `edit` tool: exact text replacements in one file. Every `oldText`
  must match exactly once in the original file, and matches must not
  overlap. The details carry a diff for the chat.
  """
  @behaviour FathomAgent.Tool

  alias FathomAgent.Tool

  @context 3

  @impl true
  def name, do: "edit"

  @impl true
  def description,
    do:
      "Edit a single file using exact text replacement. Every edits[].oldText must match a " <>
        "unique, non-overlapping region of the original file. If two changes affect the same " <>
        "block or nearby lines, merge them into one edit. Keep oldText as small as possible " <>
        "while still unique."

  @impl true
  def parameters do
    %{
      type: "object",
      properties: %{
        path: %{type: "string", description: "Path to the file to edit (relative or absolute)"},
        edits: %{
          type: "array",
          description:
            "One or more targeted replacements, each matched against the original file.",
          items: %{
            type: "object",
            properties: %{
              oldText: %{
                type: "string",
                description:
                  "Exact text for one targeted replacement. Must be unique in the file."
              },
              newText: %{type: "string", description: "Replacement text for this targeted edit."}
            },
            required: ["oldText", "newText"]
          }
        }
      },
      required: ["path", "edits"]
    }
  end

  @impl true
  def run(%{"path" => path, "edits" => [_ | _] = edits}, context) when is_binary(path) do
    full = Tool.path(context, path)

    with {:ok, original} <- read(full),
         {:ok, ranges} <- locate(original, edits),
         :ok <- disjoint(ranges) do
      updated = apply_ranges(original, ranges)

      case File.write(full, updated) do
        :ok ->
          {hunks, first} = diff(original, updated)

          {:ok,
           %{
             content: "Replaced #{length(ranges)} block(s) in #{full}.",
             details: %{path: full, line: first, hunks: hunks}
           }}

        {:error, reason} ->
          {:error, "Could not write #{full}: #{:file.format_error(reason)}"}
      end
    end
  end

  def run(_args, _context), do: {:error, "`path` and a non-empty `edits` list are required"}

  defp read(path) do
    case File.read(path) do
      {:ok, text} -> {:ok, text}
      {:error, :enoent} -> {:error, "File not found: #{path}"}
      {:error, reason} -> {:error, "Could not read #{path}: #{:file.format_error(reason)}"}
    end
  end

  defp locate(text, edits) do
    edits
    |> Enum.with_index(1)
    |> Enum.reduce_while({:ok, []}, fn
      {%{"oldText" => old, "newText" => new}, n}, {:ok, acc}
      when is_binary(old) and is_binary(new) and old != "" ->
        case :binary.matches(text, old) do
          [{start, length}] ->
            {:cont, {:ok, [{start, length, new, n} | acc]}}

          [] ->
            {:halt, {:error, "Edit #{n}: oldText was not found in the file."}}

          matches ->
            {:halt,
             {:error, "Edit #{n}: oldText matches #{length(matches)} places; make it unique."}}
        end

      {_edit, n}, _acc ->
        {:halt, {:error, "Edit #{n} needs a non-empty oldText and a newText."}}
    end)
    |> case do
      {:ok, ranges} -> {:ok, Enum.sort(ranges)}
      error -> error
    end
  end

  defp disjoint(ranges) do
    ranges
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.find(fn [{s1, l1, _, _}, {s2, _, _, _}] -> s1 + l1 > s2 end)
    |> case do
      nil ->
        :ok

      [{_, _, _, a}, {_, _, _, b}] ->
        {:error, "Edits #{a} and #{b} overlap; merge them into one edit."}
    end
  end

  defp apply_ranges(text, ranges) do
    {parts, rest_at} =
      Enum.reduce(ranges, {[], 0}, fn {start, length, new, _n}, {parts, at} ->
        {[new, binary_part(text, at, start - at) | parts], start + length}
      end)

    IO.iodata_to_binary(
      Enum.reverse([binary_part(text, rest_at, byte_size(text) - rest_at) | parts])
    )
  end

  @doc false
  # Hunks of `%{kind: :same | :del | :add, old: n | nil, new: n | nil, text:}`
  # with #{@context} lines of context, and the first changed line.
  def diff(old, new) do
    lines =
      List.myers_difference(String.split(old, "\n"), String.split(new, "\n"))
      |> number(1, 1, [])

    changed = for {%{kind: kind}, i} <- Enum.with_index(lines), kind != :same, do: i
    keep = MapSet.new(for i <- changed, j <- (i - @context)..(i + @context)//1, do: j)

    hunks =
      lines
      |> Enum.with_index()
      |> Enum.filter(fn {_line, i} -> MapSet.member?(keep, i) end)
      |> Enum.chunk_while(
        [],
        fn {line, i}, acc ->
          case acc do
            [{_, j} | _] when j != i - 1 -> {:cont, unindex(acc), [{line, i}]}
            _ -> {:cont, [{line, i} | acc]}
          end
        end,
        fn acc -> {:cont, unindex(acc), []} end
      )
      |> Enum.reject(&(&1 == []))

    first = Enum.find_value(lines, fn line -> if line.kind != :same, do: line.new || line.old end)
    {hunks, first}
  end

  defp unindex(acc), do: acc |> Enum.reverse() |> Enum.map(&elem(&1, 0))

  defp number([], _o, _n, acc), do: Enum.reverse(acc)

  defp number([{:eq, lines} | rest], o, n, acc) do
    entries =
      for {text, i} <- Enum.with_index(lines),
          do: %{kind: :same, old: o + i, new: n + i, text: text}

    number(rest, o + length(lines), n + length(lines), Enum.reverse(entries, acc))
  end

  defp number([{:del, lines} | rest], o, n, acc) do
    entries =
      for {text, i} <- Enum.with_index(lines), do: %{kind: :del, old: o + i, new: nil, text: text}

    number(rest, o + length(lines), n, Enum.reverse(entries, acc))
  end

  defp number([{:ins, lines} | rest], o, n, acc) do
    entries =
      for {text, i} <- Enum.with_index(lines), do: %{kind: :add, old: nil, new: n + i, text: text}

    number(rest, o, n + length(lines), Enum.reverse(entries, acc))
  end
end
