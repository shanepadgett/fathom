defmodule FathomEditor.Servers do
  @moduledoc """
  Which language server runs for a language, and where.

  Elixir uses Expert, the official server: the one on `PATH` when there is
  one, otherwise a pinned release downloaded once into `<home>/tools` and
  checked against its published SHA-256. Other languages use a server
  found on the login shell's `PATH`.
  """

  @expert_version "0.1.11"
  # From the release's expert_checksums.txt.
  @expert_sha256 %{
    "darwin_arm64" => "3ee75d20b494c065856cf3aa8ff0d6ab6dec5109e10b25d4f93fca57bf94050c",
    "darwin_amd64" => "524977923fce54a097999b6a950aa329f219aa5279b5e6a6fedb144af06b24a3",
    "linux_arm64" => "742b6b1381585dc34627ac3de123d8efd2f9c57e1b56e7224802c6256c709fc8",
    "linux_amd64" => "59435e56710dcacae26062a7c8b43913f04c2b9cb1d3bc8a229fa47421e30ab4"
  }

  @path_servers %{
    "javascript" => [{"typescript-language-server", ["--stdio"]}],
    "typescript" => [{"typescript-language-server", ["--stdio"]}],
    "rust" => [{"rust-analyzer", []}],
    "python" => [{"pyright-langserver", ["--stdio"]}, {"pylsp", []}]
  }

  # Files that mark a project root, nearest first, per language.
  @markers %{
    "elixir" => ["mix.exs"],
    "rust" => ["Cargo.toml"],
    "javascript" => ["package.json", "jsconfig.json"],
    "typescript" => ["tsconfig.json", "package.json"],
    "python" => ["pyproject.toml", "setup.py"]
  }

  @type resolved :: {:ok, Path.t(), [String.t()], String.t()} | :install | {:error, String.t()}

  @doc "The command for `language`: `:install` when Expert must be downloaded first."
  @spec command(String.t()) :: resolved()
  def command("elixir") do
    cond do
      path = Fathom.Shell.find("expert") -> {:ok, path, ["--stdio"], "Expert"}
      File.exists?(expert_path()) -> {:ok, expert_path(), ["--stdio"], "Expert"}
      expert_target() -> :install
      true -> {:error, "No Expert build for this computer"}
    end
  end

  def command(language) do
    candidates = Map.get(@path_servers, language, [])

    case Enum.find_value(candidates, fn {name, args} ->
           (path = Fathom.Shell.find(name)) && {path, args, name}
         end) do
      {path, args, name} -> {:ok, path, args, name}
      nil when candidates == [] -> {:error, "No language server for #{language}"}
      nil -> {:error, "Install #{candidates |> hd() |> elem(0)} for #{language} support"}
    end
  end

  @doc "The project root for `path`: the nearest folder with a marker, within `folder`."
  @spec root(String.t(), Path.t(), Path.t()) :: Path.t()
  def root(language, path, folder) do
    markers = Map.get(@markers, language, [])

    path
    |> Path.dirname()
    |> Stream.iterate(&Path.dirname/1)
    |> Enum.take_while(&(String.starts_with?(&1 <> "/", folder <> "/") and &1 != "/"))
    |> Enum.find(folder, fn dir -> Enum.any?(markers, &File.exists?(Path.join(dir, &1))) end)
  end

  defp expert_path,
    do: Path.join([Fathom.Environment.home(), "tools", "expert-#{@expert_version}"])

  @doc "Downloads Expert into `<home>/tools` and verifies it."
  @spec install_expert() :: {:ok, Path.t()} | {:error, String.t()}
  def install_expert do
    target = expert_target()
    path = expert_path()
    temp = path <> ".download"

    url =
      "https://github.com/expert-lsp/expert/releases/download/v#{@expert_version}/expert_#{target}"

    File.mkdir_p!(Path.dirname(path))

    with {:ok, _} <-
           Fathom.HTTP.request(url: url, into: File.stream!(temp), receive_timeout: 300_000),
         :ok <- verify(temp, @expert_sha256[target]) do
      File.chmod!(temp, 0o755)
      # A new file, renamed into place: macOS kills a signed binary rewritten in place.
      File.rename!(temp, path)
      {:ok, path}
    else
      {:error, %{__exception__: true} = e} ->
        File.rm(temp)
        {:error, "Downloading Expert failed: " <> Exception.message(e)}

      {:error, message} ->
        File.rm(temp)
        {:error, message}
    end
  end

  defp verify(file, expected) do
    actual =
      file
      |> File.stream!(2_097_152)
      |> Enum.reduce(:crypto.hash_init(:sha256), &:crypto.hash_update(&2, &1))
      |> :crypto.hash_final()
      |> Base.encode16(case: :lower)

    if actual == expected, do: :ok, else: {:error, "The Expert download failed its checksum"}
  end

  defp expert_target do
    arch = :erlang.system_info(:system_architecture) |> to_string()

    target =
      case {:os.type(), arch} do
        {{:unix, :darwin}, "aarch64" <> _} -> "darwin_arm64"
        {{:unix, :darwin}, "x86_64" <> _} -> "darwin_amd64"
        {{:unix, :linux}, "aarch64" <> _} -> "linux_arm64"
        {{:unix, :linux}, "x86_64" <> _} -> "linux_amd64"
        _ -> nil
      end

    if Map.has_key?(@expert_sha256, target), do: target
  end
end
