defmodule FathomCodingTools.Write do
  @moduledoc "The `write` tool: creates or replaces a file."
  @behaviour FathomAgent.Tool

  alias FathomAgent.Tool

  @preview_chars 20_000

  @impl true
  def name, do: "write"

  @impl true
  def description,
    do:
      "Write content to a file. Creates the file if it doesn't exist, overwrites it if it " <>
        "does. Creates parent directories."

  @impl true
  def parameters do
    %{
      type: "object",
      properties: %{
        path: %{type: "string", description: "Path to the file to write (relative or absolute)"},
        content: %{type: "string", description: "Content to write to the file"}
      },
      required: ["path", "content"]
    }
  end

  @impl true
  def run(%{"path" => path, "content" => content}, context)
      when is_binary(path) and is_binary(content) do
    full = Tool.path(context, path)
    existed? = File.exists?(full)

    with :ok <- File.mkdir_p(Path.dirname(full)),
         :ok <- File.write(full, content) do
      verb = if existed?, do: "Overwrote", else: "Created"

      {:ok,
       %{
         content: "#{verb} #{full} (#{byte_size(content)} bytes).",
         details: %{
           path: full,
           created: not existed?,
           lines: length(String.split(content, "\n")),
           preview: String.slice(content, 0, @preview_chars)
         }
       }}
    else
      {:error, reason} -> {:error, "Could not write #{full}: #{:file.format_error(reason)}"}
    end
  end

  def run(_args, _context), do: {:error, "`path` and `content` are required"}
end
