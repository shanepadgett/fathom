defmodule FathomEditor.Files do
  @moduledoc "Listing, reading, and writing files for the editor."

  @hidden ~w(.git _build deps node_modules target .elixir_ls .expert .DS_Store .next dist)
  @max_bytes 4 * 1024 * 1024

  @type entry :: %{name: String.t(), path: Path.t(), dir: boolean()}

  @doc "A folder's entries, folders first, without build and tool folders."
  @spec list(Path.t()) :: [entry()]
  def list(dir) do
    case File.ls(dir) do
      {:ok, names} ->
        names
        |> Enum.reject(&(&1 in @hidden))
        |> Enum.map(fn name ->
          path = Path.join(dir, name)
          %{name: name, path: path, dir: File.dir?(path)}
        end)
        |> Enum.sort_by(&{not &1.dir, String.downcase(&1.name)})

      {:error, _} ->
        []
    end
  end

  @spec hidden?(Path.t()) :: boolean()
  def hidden?(path), do: path |> Path.split() |> Enum.any?(&(&1 in @hidden))

  @spec read(Path.t()) :: {:ok, String.t()} | {:error, String.t()}
  def read(path) do
    with {:ok, %{size: size, type: :regular}} <- File.stat(path),
         true <- size <= @max_bytes || {:error, "#{Path.basename(path)} is larger than 4 MB"},
         {:ok, text} <- File.read(path),
         true <- String.valid?(text) || {:error, "#{Path.basename(path)} is not a text file"} do
      {:ok, text}
    else
      {:ok, _stat} -> {:error, "#{path} is not a file"}
      {:error, message} when is_binary(message) -> {:error, message}
      {:error, reason} -> {:error, "Could not read #{path}: #{:file.format_error(reason)}"}
    end
  end

  @spec write(Path.t(), String.t()) :: :ok | {:error, String.t()}
  def write(path, content) do
    case File.write(path, content) do
      :ok -> :ok
      {:error, reason} -> {:error, "Could not save #{path}: #{:file.format_error(reason)}"}
    end
  end

  @doc "The CodeMirror and LSP language id for a file, or nil."
  @spec language(Path.t()) :: String.t() | nil
  def language(path) do
    case Path.extname(path) do
      ext when ext in ~w(.ex .exs) -> "elixir"
      ext when ext in ~w(.js .mjs .cjs .jsx) -> "javascript"
      ext when ext in ~w(.ts .mts .cts .tsx) -> "typescript"
      ext when ext in ~w(.html .heex .htm) -> "html"
      ".css" -> "css"
      ".json" -> "json"
      ext when ext in ~w(.md .markdown) -> "markdown"
      ".rs" -> "rust"
      ".py" -> "python"
      ext when ext in ~w(.yml .yaml) -> "yaml"
      _ -> nil
    end
  end

  @spec uri(Path.t()) :: String.t()
  def uri(path), do: "file://" <> URI.encode(path)
end
