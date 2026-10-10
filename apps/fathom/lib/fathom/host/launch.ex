defmodule Fathom.Host.Launch do
  @moduledoc """
  The handshake with the desktop shell.

  When a launch token is configured (desktop mode), the host prints one line
  once the endpoint listens:

      FATHOM_READY http://127.0.0.1:PORT/?launch=TOKEN

  The shell opens that URL; `FathomWeb.LaunchGate` trades the token for a
  session. With `FATHOM_PARENT_STDIN` set, the host stops when its stdin
  closes, so it never outlives the shell.
  """
  use Task, restart: :transient

  def start_link(_), do: Task.start_link(&run/0)

  defp run do
    if System.get_env("FATHOM_PARENT_STDIN"), do: watch_parent()

    # Not serving, as under plain `iex -S mix`: nothing to announce.
    with {:ok, {_ip, port}} <- FathomWeb.Endpoint.server_info(:http) do
      announce(port, Application.get_env(:fathom, :launch_token))
    end
  end

  defp announce(port, token) do
    url =
      if token,
        do: "http://127.0.0.1:#{port}/?launch=#{token}",
        else: "http://127.0.0.1:#{port}/"

    IO.puts("FATHOM_READY #{url}")
  end

  defp watch_parent do
    spawn(fn ->
      wait_for_eof()
      System.stop()
    end)
  end

  defp wait_for_eof do
    case IO.read(:stdio, :line) do
      :eof -> :ok
      {:error, _} -> :ok
      _ -> wait_for_eof()
    end
  end
end
