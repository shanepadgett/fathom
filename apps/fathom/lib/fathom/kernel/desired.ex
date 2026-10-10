defmodule Fathom.Kernel.Desired do
  @moduledoc """
  What the user chose for each plugin, saved in `plugins.json` under the
  Fathom home: `%{id => %{"enabled" => boolean, "config" => map}}`.
  """
  require Logger

  @spec read(Path.t()) :: map()
  def read(home) do
    with {:ok, text} <- File.read(path(home)),
         {:ok, %{} = desired} <- Jason.decode(text) do
      desired
    else
      {:error, :enoent} ->
        %{}

      other ->
        Logger.error(
          "Ignoring unreadable #{path(home)}: #{inspect(other)}; the file was left intact"
        )

        %{}
    end
  end

  @doc "Writes atomically: a temp file renamed over the old one."
  @spec write(Path.t(), map()) :: :ok
  def write(home, desired) do
    File.mkdir_p!(home)
    temp = path(home) <> ".tmp"
    File.write!(temp, Jason.encode_to_iodata!(desired, pretty: true))
    File.rename!(temp, path(home))
  end

  defp path(home), do: Path.join(home, "plugins.json")
end
