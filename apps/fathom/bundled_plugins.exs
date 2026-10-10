# Bundled code is path dependencies of the host, discovered by directory.
# mix.exs uses this for deps, and config/dev.exs for code reloading. The host
# never names a plugin in code; the kernel finds them by their app env.
defmodule Fathom.BundledPlugins do
  @repo Path.expand("../..", __DIR__)

  @doc "Plugins: OTP applications under plugins/ and examples/, run by the kernel."
  def list, do: scan(["plugins", "examples"])

  def apps, do: Enum.map(list(), &elem(&1, 0))

  @doc "Libraries under packages/: the SDK and definition packages. Never started."
  def libraries, do: scan(["packages"]) |> Enum.map(&elem(&1, 0))

  defp scan(roots) do
    for root <- roots,
        mix_file <- Path.wildcard(Path.join([@repo, root, "*", "mix.exs"])),
        app = app_name(mix_file) do
      {app, Path.dirname(mix_file)}
    end
  end

  defp app_name(mix_file) do
    case Regex.run(~r/app:\s*:(\w+)/, File.read!(mix_file)) do
      [_, app] -> String.to_atom(app)
      nil -> nil
    end
  end
end
