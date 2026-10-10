defmodule Fathom.Plugins.Tailwind do
  @moduledoc """
  The Tailwind binary that builds local plugin CSS. It is 76 MB, more than
  Fathom itself, so it is downloaded on the first build that needs it,
  checked against the SHA-256 Tailwind publishes, and kept under
  `~/.fathom/tools`. Runs in the builder process.

  Keep `@version` in step with `config :tailwind` in the host's config.exs.
  """

  @version "4.3.3"

  # From the GitHub release's asset digests.
  @sha256 %{
    "linux-arm64" => "55fd0b241214eff3de1e8ee4f22796662f2d2e7a49bcfca7477cfd0bac398195",
    "linux-x64" => "dc61b3ac6b8c9ca874c0cc4c57b2409791a64c5540404ca5f5367360babc313a",
    "macos-arm64" => "cdf646702987a743464dff4d9c60fd4480d1c1e73dd819a9a67f1078815dce9d",
    "macos-x64" => "7922e0953f2110c05976e3bf58f14e643d90427575e766b7d433f5f80cbee7e1",
    "windows-x64.exe" => "e0e260ce048014e9268f6237ff18f8ccf02cef521cbd0ae04e82c2cdf7aa3955"
  }

  @doc "Returns the binary's path, downloading it into `tools` first if needed."
  @spec ensure(Path.t()) :: {:ok, Path.t()} | {:error, String.t()}
  def ensure(tools) do
    with {:ok, target} <- target() do
      path = Path.join(tools, "tailwindcss-#{@version}-#{target}")
      if File.exists?(path), do: {:ok, path}, else: download(target, path)
    end
  end

  defp download(target, path) do
    url =
      "https://github.com/tailwindlabs/tailwindcss/releases/download/v#{@version}/tailwindcss-#{target}"

    temp = path <> ".download"
    File.mkdir_p!(Path.dirname(path))
    IO.puts("Downloading Tailwind #{@version} for plugin CSS (once)")
    {:ok, _} = Application.ensure_all_started([:inets, :ssl])

    ssl = [
      verify: :verify_peer,
      cacerts: :public_key.cacerts_get(),
      customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
    ]

    request = {String.to_charlist(url), [{~c"user-agent", ~c"fathom"}]}

    with {:ok, :saved_to_file} <-
           :httpc.request(:get, request, [ssl: ssl, timeout: 300_000], stream: to_charlist(temp)),
         :ok <- verify(temp, @sha256[target]) do
      File.chmod!(temp, 0o755)
      # A new file, renamed into place: macOS kills a signed binary rewritten in place.
      File.rename!(temp, path)
      {:ok, path}
    else
      {:error, message} when is_binary(message) ->
        File.rm(temp)
        {:error, message}

      other ->
        File.rm(temp)
        {:error, "Downloading Tailwind from #{url} failed: #{inspect(other)}"}
    end
  end

  defp verify(file, expected) do
    actual =
      file
      |> File.stream!(2_097_152)
      |> Enum.reduce(:crypto.hash_init(:sha256), &:crypto.hash_update(&2, &1))
      |> :crypto.hash_final()
      |> Base.encode16(case: :lower)

    if actual == expected,
      do: :ok,
      else:
        {:error, "Tailwind download failed its checksum (got #{actual}, expected #{expected})"}
  end

  defp target do
    arch = :erlang.system_info(:system_architecture) |> to_string()

    target =
      case {:os.type(), arch} do
        {{:unix, :darwin}, "aarch64" <> _} -> "macos-arm64"
        {{:unix, :darwin}, "x86_64" <> _} -> "macos-x64"
        {{:unix, :linux}, "aarch64" <> _} -> "linux-arm64"
        {{:unix, :linux}, "x86_64" <> _} -> "linux-x64"
        {{:win32, _}, _} -> "windows-x64.exe"
        _ -> nil
      end

    if target, do: {:ok, target}, else: {:error, "No Tailwind binary for #{arch}"}
  end
end
