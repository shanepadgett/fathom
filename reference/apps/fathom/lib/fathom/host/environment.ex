defmodule Fathom.Host.Environment do
  @moduledoc "The harness implementation of `Fathom.Environment`."
  @behaviour Fathom.Environment

  @impl true
  def home, do: Application.fetch_env!(:fathom, :home)

  @impl true
  def open_external(url) do
    case URI.parse(url) do
      %URI{scheme: scheme, host: host} when scheme in ["http", "https"] and is_binary(host) ->
        {command, args} = opener(url)

        case System.cmd(command, args, stderr_to_stdout: true) do
          {_, 0} -> :ok
          {output, status} -> {:error, "#{command} exited #{status}: #{output}"}
        end

      _ ->
        {:error, "Only http and https URLs open externally"}
    end
  end

  defp opener(url) do
    case :os.type() do
      {:unix, :darwin} -> {"open", [url]}
      {:win32, _} -> {"cmd", ["/c", "start", "", url]}
      _ -> {"xdg-open", [url]}
    end
  end
end
