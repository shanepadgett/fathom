defmodule FathomPluginManagerWeb.HeaderLive do
  @moduledoc """
  The workspace header item for plugins: shown when local plugin files
  changed (Reload builds and applies them), while they build, when a change
  waits for a restart, and when a plugin or build has failed.
  Details are in Settings › Plugins.
  """
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: Fathom.KernelControl.subscribe()
    {:ok, assign_state(socket)}
  end

  @impl true
  def handle_info({:fathom_kernel, :changed}, socket), do: {:noreply, assign_state(socket)}

  @impl true
  def handle_event("reload", _params, socket) do
    Fathom.KernelControl.rebuild()
    {:noreply, socket}
  end

  def handle_event("restart", _params, socket) do
    Fathom.KernelControl.restart_stale()
    {:noreply, assign_state(socket)}
  end

  defp assign_state(socket) do
    plugins = Fathom.KernelControl.plugins()
    builds = Fathom.KernelControl.builds()

    assign(socket,
      building: builds.state == :building,
      pending: builds.pending,
      stale: Enum.count(plugins, & &1.stale),
      failed: for(p <- plugins, p.state == :failed, do: p.id),
      broken: for(b <- builds.plugins, b.error, do: b.name) ++ List.wrap(builds.error && "build")
    )
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div id="plugin-status" class="flex items-center gap-2">
      <span :if={@building} class="flex items-center gap-1.5 type-micro text-muted">
        <.icon name="ph-circle-notch" class="animate-session-spin text-sm" /> Building plugins
      </span>
      <span
        :if={@broken != []}
        class="flex items-center gap-1.5 type-micro text-danger"
        title="See Settings › Plugins"
      >
        <.icon name="ph-warning-circle" class="text-sm" /> Build failed: {Enum.join(@broken, ", ")}
      </span>
      <span
        :if={@failed != []}
        class="flex items-center gap-1.5 type-micro text-danger"
        title="See Settings › Plugins"
      >
        <.icon name="ph-x-circle" class="text-sm" /> Stopped: {Enum.join(@failed, ", ")}
      </span>
      <.button
        :if={@pending != [] and not @building}
        id="reload-plugins"
        variant="primary"
        phx-click="reload"
        title={Enum.join(@pending, ", ")}
      >
        {if length(@pending) == 1,
          do: "1 plugin changed",
          else: "#{length(@pending)} plugins changed"} · Reload
      </.button>
      <.button :if={@stale > 0} id="restart-stale" phx-click="restart">
        Restart {if @stale == 1, do: "1 plugin", else: "#{@stale} plugins"}
      </.button>
    </div>
    """
  end
end
