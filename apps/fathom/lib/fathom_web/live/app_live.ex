defmodule FathomWeb.AppLive do
  @moduledoc """
  The renderer root. Shows the first `Fathom.UI.AppShell` contribution, and
  the recovery panel when no plugin provides a shell. Recovery is harness
  code, so it survives the removal of every UI plugin.
  """
  use FathomWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Fathom.KernelControl.subscribe()
      Fathom.Events.subscribe(Fathom.Plugins.Local.topic())
    end

    {:ok,
     socket
     |> assign(page_title: "Fathom", error: nil)
     |> assign_registry(:shells, Fathom.UI.AppShell)
     |> assign_plugins()}
  end

  @impl true
  def handle_info({:fathom_kernel, :changed}, socket), do: {:noreply, assign_plugins(socket)}

  # Local plugin CSS changed; the page swaps its stylesheet.
  def handle_info({:fathom_plugins, {:css, version}}, socket),
    do: {:noreply, push_event(socket, "fathom:plugins-css", %{href: "/plugins.css?v=#{version}"})}

  @impl true
  def handle_event("change", %{"id" => id, "action" => action}, socket) do
    action = if action == "enable", do: :enable, else: :restart

    socket =
      case Fathom.Kernel.change(id, action) do
        :ok -> assign(socket, error: nil)
        {:error, message} -> assign(socket, error: "#{id}: #{message}")
      end

    {:noreply, assign_plugins(socket)}
  end

  defp assign_plugins(socket), do: assign(socket, plugins: Fathom.Kernel.plugins())

  @impl true
  def render(assigns) do
    ~H"""
    <%= if @shells != [] do %>
      <.slot_view socket={@socket} entries={@shells} mode="single" />
    <% else %>
      <.recovery_panel plugins={@plugins} error={@error} />
    <% end %>
    """
  end

  attr :plugins, :list, required: true
  attr :error, :string, default: nil

  defp recovery_panel(assigns) do
    ~H"""
    <main class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 px-8 py-12">
      <header>
        <span class="type-wordmark">Fathom<span class="text-action">.</span></span>
        <p class="type-description mt-4">
          No plugin provides the application shell. Enable or restart one below.
        </p>
      </header>
      <.inline_notice :if={@error} error>{@error}</.inline_notice>
      <.card padding="rows">
        <div
          :for={plugin <- @plugins}
          class="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0"
        >
          <span>
            <span class="block type-label">{plugin.id}</span>
            <span class="mt-1 block type-description">{describe(plugin)}</span>
          </span>
          <.button
            phx-click="change"
            phx-value-id={plugin.id}
            phx-value-action={if plugin.enabled, do: "restart", else: "enable"}
          >
            {if plugin.enabled, do: "Restart", else: "Enable"}
          </.button>
        </div>
      </.card>
    </main>
    """
  end

  defp describe(%{state: :blocked, waiting_on: waiting}),
    do: "Waiting on " <> Enum.map_join(waiting, ", ", &inspect/1)

  defp describe(%{state: :failed, last_error: error}), do: "Failed: #{error}"
  defp describe(%{state: state}), do: state |> Atom.to_string() |> String.capitalize()
end
