defmodule FathomWeb.PluginCSSController do
  @moduledoc "Serves the CSS built for local plugins. The URL carries its version."
  use FathomWeb, :controller

  def show(conn, _params) do
    conn =
      conn |> put_resp_content_type("text/css") |> put_resp_header("cache-control", "no-cache")

    case Fathom.Plugins.Local.css_path() do
      nil -> send_resp(conn, 200, "")
      path -> send_file(conn, 200, path)
    end
  end
end
