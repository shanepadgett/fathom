defmodule FathomCodingTools.Read do
  @moduledoc "The `read` tool: a text file, a window of lines at a time."
  @behaviour FathomAgent.Tool

  alias FathomAgent.Tool
  alias FathomCodingTools.Truncate

  @impl true
  def name, do: "read"

  @impl true
  def description,
    do:
      "Read the contents of a text file. Output is truncated to #{Truncate.max_lines()} lines " <>
        "or #{div(Truncate.max_bytes(), 1024)}KB, whichever is hit first. Use offset/limit for " <>
        "large files. When you need the full file, continue with offset until complete."

  @impl true
  def parameters do
    %{
      type: "object",
      properties: %{
        path: %{type: "string", description: "Path to the file to read (relative or absolute)"},
        offset: %{type: "number", description: "Line number to start reading from (1-indexed)"},
        limit: %{type: "number", description: "Maximum number of lines to read"}
      },
      required: ["path"]
    }
  end

  @impl true
  def run(%{"path" => path} = args, context) when is_binary(path) do
    full = Tool.path(context, path)

    with {:ok, text} <- read(full) do
      lines = String.split(text, "\n")
      total = length(lines)
      offset = max(integer(args["offset"]) || 1, 1)
      limit = integer(args["limit"])

      if offset > total and total > 0 do
        {:error, "Offset #{offset} is beyond the end of the file (#{total} lines)"}
      else
        window =
          lines |> Enum.drop(offset - 1) |> then(&if(limit, do: Enum.take(&1, limit), else: &1))

        {shown, cut?} = Truncate.head(window)
        last = offset + length(shown) - 1

        notice =
          cond do
            cut? or last < total ->
              "\n\n[Showing lines #{offset}-#{last} of #{total}. Use offset=#{last + 1} to continue.]"

            true ->
              ""
          end

        {:ok,
         %{
           content: Enum.join(shown, "\n") <> notice,
           details: %{path: full, from: offset, to: last, total: total}
         }}
      end
    end
  end

  def run(_args, _context), do: {:error, "`path` is required"}

  defp read(path) do
    case File.read(path) do
      {:ok, text} ->
        if String.contains?(binary_part(text, 0, min(byte_size(text), 8000)), <<0>>),
          do: {:error, "#{path} is a binary file"},
          else: {:ok, String.replace_invalid(text)}

      {:error, :enoent} ->
        {:error, "File not found: #{path}"}

      {:error, :eisdir} ->
        {:error, "#{path} is a directory. Use bash with ls to list it."}

      {:error, reason} ->
        {:error, "Could not read #{path}: #{:file.format_error(reason)}"}
    end
  end

  defp integer(n) when is_integer(n) and n > 0, do: n
  defp integer(n) when is_float(n) and n > 0, do: trunc(n)
  defp integer(_n), do: nil
end
