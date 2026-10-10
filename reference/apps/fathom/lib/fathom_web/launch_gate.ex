defmodule FathomWeb.LaunchGate do
  @moduledoc """
  Admits only the window the shell opened. The first request carries
  `?launch=TOKEN`; it becomes a session flag, and the token leaves the URL.
  Without a configured token (browser development) every request passes.
  """
  import Plug.Conn
  import Phoenix.Controller, only: [redirect: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    case Application.get_env(:fathom, :launch_token) do
      nil ->
        conn

      token ->
        cond do
          Plug.Crypto.secure_compare(conn.params["launch"] || "", token) ->
            conn |> put_session(:launched, true) |> redirect(to: conn.request_path) |> halt()

          get_session(conn, :launched) ->
            conn

          true ->
            conn |> send_resp(403, "Open Fathom from the app.") |> halt()
        end
    end
  end

  def on_mount(:default, _params, session, socket) do
    if Application.get_env(:fathom, :launch_token) == nil or session["launched"],
      do: {:cont, socket},
      else: {:halt, socket}
  end
end
