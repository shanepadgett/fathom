defmodule FathomWorkspaceWeb.ShellLive do
  @moduledoc """
  The application shell. Navigation lives in this view's state: the
  workspace with a selected page, or settings with a selected section.
  """
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(area: :workspace, page: nil, section: nil, sidebar_open: true)
     |> assign_registry(:pages, Fathom.UI.Pages)
     |> assign_registry(:sections, Fathom.UI.SettingsSections)
     |> assign_registry(:header, Fathom.UI.HeaderActions)
     |> assign_registry(:status, Fathom.UI.StatusItems)
     |> assign_registry(:left, Fathom.UI.LeftSidebar)
     |> assign_registry(:right, Fathom.UI.RightSidebar)}
  end

  @impl true
  def handle_event("page", %{"id" => id}, socket), do: {:noreply, assign(socket, page: id)}
  def handle_event("settings", _params, socket), do: {:noreply, assign(socket, area: :settings)}
  def handle_event("section", %{"id" => id}, socket), do: {:noreply, assign(socket, section: id)}

  def handle_event("close_settings", _params, socket),
    do: {:noreply, assign(socket, area: :workspace)}

  def handle_event("toggle_sidebar", _params, socket),
    do: {:noreply, update(socket, :sidebar_open, &(!&1))}

  # The selection falls back to the first entry when its plugin goes away.
  defp selected(entries, key) do
    if Enum.any?(entries, &(&1.key == key)),
      do: key,
      else: entries |> List.first() |> then(&(&1 && &1.key))
  end

  @impl true
  def render(%{area: :settings} = assigns) do
    assigns = assign(assigns, :current, selected(assigns.sections, assigns.section))

    ~H"""
    <div class="flex h-dvh min-w-0 flex-col bg-canvas text-ink">
      <header class="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <.wordmark />
        <.icon_button icon="ph-x" label="Close settings" toolbar phx-click="close_settings" />
      </header>
      <div class="flex min-h-0 flex-1">
        <nav aria-label="Settings" class="w-48 shrink-0 overflow-auto border-r border-line bg-surface">
          <.nav_item
            :for={entry <- @sections}
            label={entry.value.label}
            icon={entry.value[:icon]}
            current={entry.key == @current}
            phx-click="section"
            phx-value-id={entry.key}
          />
        </nav>
        <main class="min-w-0 flex-1 overflow-y-auto">
          <.slot_view socket={@socket} entries={@sections} mode="keyed" selected={@current}>
            <:fallback>
              <.empty_state>Its plugin may be disabled. Choose another section.</.empty_state>
            </:fallback>
          </.slot_view>
        </main>
      </div>
    </div>
    """
  end

  def render(assigns) do
    assigns = assign(assigns, :current, selected(assigns.pages, assigns.page))

    ~H"""
    <div class="relative flex h-dvh min-w-workspace-minimum flex-col bg-canvas text-ink">
      <header class="relative flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4">
        <div class="flex min-w-0 items-center gap-6">
          <.wordmark />
          <.icon_button
            :if={@left != []}
            icon="ph-sidebar-simple"
            label={if @sidebar_open, do: "Close sidebar", else: "Open sidebar"}
            toolbar
            aria-expanded={to_string(@sidebar_open)}
            phx-click="toggle_sidebar"
          />
        </div>
        <div class="flex h-full items-center">
          <.slot_view socket={@socket} entries={@header} />
          <.icon_button class="mx-3" icon="ph-gear" label="Settings" toolbar phx-click="settings" />
        </div>
      </header>
      <div class="relative z-0 flex min-h-0 flex-1">
        <aside
          :if={@left != [] and @sidebar_open}
          aria-label="Workspace sidebar"
          class="fathom-sidebar w-sidebar resize-x overflow-auto"
        >
          <.slot_view socket={@socket} entries={@left} mode="single" />
        </aside>
        <main class="flex min-w-0 flex-1 flex-col overflow-auto">
          <.tabs
            :if={@pages != []}
            label="Workspace pages"
            items={for entry <- @pages, do: {entry.key, entry.value.label}}
            selected={@current}
            on_select="page"
          />
          <.slot_view socket={@socket} entries={@pages} mode="keyed" selected={@current}>
            <:fallback>
              <.empty_state>
                Open Settings to connect providers. Workspace pages appear when their plugins are enabled.
              </.empty_state>
            </:fallback>
          </.slot_view>
        </main>
        <aside
          :if={@right != []}
          aria-label="Inspector"
          class="fathom-sidebar w-sidebar overflow-auto"
          data-side="right"
        >
          <.slot_view socket={@socket} entries={@right} mode="single" />
        </aside>
      </div>
      <footer class="flex min-h-12 shrink-0 items-center gap-4 border-t border-line bg-surface px-4 text-sm">
        <.slot_view socket={@socket} entries={@status} />
      </footer>
    </div>
    """
  end

  defp wordmark(assigns) do
    ~H"""
    <span class="type-wordmark">Fathom<span class="text-action dark:text-teal-200">.</span></span>
    """
  end
end
