defmodule FathomCredentials.OAuth.Callback do
  @moduledoc "The loopback page the provider redirects to during a PKCE login."
  @behaviour Plug
  import Plug.Conn

  @impl true
  def init(opts), do: Map.new(opts)

  @impl true
  def call(%Plug.Conn{request_path: path} = conn, %{path: path} = opts) do
    url = "http://127.0.0.1#{path}?#{conn.query_string}"

    case opts.parse.(url) do
      {:ok, code} ->
        send(opts.owner, {:callback, code})
        reply(conn, 200, "Login received. Return to Fathom to see the connection status.")

      {:error, _} ->
        reply(conn, 400, "Invalid login callback. Return to Fathom and try again.")
    end
  end

  def call(conn, _opts), do: reply(conn, 404, "Not found")

  defp reply(conn, status, text) do
    conn
    |> put_resp_content_type("text/plain")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(status, text)
  end
end
