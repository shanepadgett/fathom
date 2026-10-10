defmodule FathomWeb.Router do
  use FathomWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug FathomWeb.LaunchGate
    plug :put_root_layout, html: {FathomWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :plugin_assets do
    plug :fetch_session
    plug FathomWeb.LaunchGate
  end

  scope "/", FathomWeb do
    pipe_through :plugin_assets

    get "/plugins.css", PluginCSSController, :show
  end

  scope "/", FathomWeb do
    pipe_through :browser

    live_session :app, on_mount: FathomWeb.LaunchGate do
      live "/", AppLive
    end
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:fathom, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: FathomWeb.Telemetry
    end
  end
end
