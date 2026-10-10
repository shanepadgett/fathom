defmodule Fathom.Folder do
  @moduledoc """
  The folder the person is working in. Agents start there and the editor
  shows it. Saved through `Fathom.Storage`, so it survives restarts.

  Subscribers to `subscribe/0` receive:

    * `{:fathom_folder, {:changed, path}}` when the folder changes
    * `{:fathom_folder, {:open_file, path, line}}` when something asks to
      show a file, such as a tool call in the chat. Whatever shows files
      (the editor) handles it; nothing happens when none is enabled.
  """

  @topic "fathom:folder"
  @namespace "fathom"
  @recent_limit 8

  def subscribe, do: Fathom.Events.subscribe(@topic)

  @doc "The current folder; the home directory until one is chosen."
  @spec current() :: Path.t()
  def current do
    with %{"current" => path} <- saved(),
         true <- File.dir?(path),
         do: real(path),
         else: (_ -> System.user_home!())
  end

  @doc "Recently used folders, newest first, without the current one."
  @spec recent() :: [Path.t()]
  def recent do
    case saved() do
      %{"recent" => recent} ->
        recent
        |> Enum.filter(&File.dir?/1)
        |> Enum.map(&real/1)
        |> Enum.uniq()
        |> List.delete(current())

      _ ->
        []
    end
  end

  @doc "Makes `path` the current folder."
  @spec open(Path.t()) :: :ok | {:error, String.t()}
  def open(path) do
    path = real(path)

    cond do
      not File.dir?(path) ->
        {:error, "Not a folder: #{path}"}

      path == current() ->
        :ok

      true ->
        recent = [path | Enum.reject([current() | recent()], &(&1 == path))]
        save(%{"current" => path, "recent" => Enum.take(recent, @recent_limit)})
        Fathom.Events.broadcast(@topic, {:fathom_folder, {:changed, path}})
    end
  end

  @doc "Asks whatever shows files to show `path`, at `line` when given."
  @spec open_file(Path.t(), pos_integer() | nil) :: :ok
  def open_file(path, line \\ nil),
    do: Fathom.Events.broadcast(@topic, {:fathom_folder, {:open_file, real(path), line}})

  @doc """
  `path` expanded with symbolic links resolved, such as macOS's `/tmp` to
  `/private/tmp`. Tools like language servers report real paths, so files
  are named by theirs.
  """
  @spec real(Path.t()) :: Path.t()
  def real(path) do
    path |> Path.expand() |> Path.split() |> resolve("/", 0)
  end

  defp resolve([], acc, _hops), do: acc
  defp resolve(["/" | rest], _acc, hops), do: resolve(rest, "/", hops)

  defp resolve([part | rest], acc, hops) do
    next = Path.join(acc, part)

    case :file.read_link(next) do
      {:ok, target} when hops < 32 ->
        target = target |> to_string() |> Path.expand(acc)
        resolve(Path.split(target) ++ rest, "/", hops + 1)

      _ ->
        resolve(rest, next, hops)
    end
  end

  defp saved do
    if Fathom.Storage.available?(), do: Fathom.Storage.get(@namespace, "folder")
  end

  defp save(value) do
    if Fathom.Storage.available?(), do: Fathom.Storage.put(@namespace, "folder", value)
  end
end
