defmodule CounterWeb.SettingsLive do
  @moduledoc false
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: Counter.subscribe()
    {:ok, assign(socket, count: Counter.count())}
  end

  @impl true
  def handle_event("increment", _params, socket) do
    {:noreply, assign(socket, count: Counter.increment())}
  end

  @impl true
  def handle_info({:counter, count}, socket), do: {:noreply, assign(socket, count: count)}

  @impl true
  def render(assigns) do
    ~H"""
    <.settings_section title="Counter" description="A backend value, a context, and a settings page.">
      <.card padding="rows">
        <.setting_row label="Count" description="Stored by the backend between runs.">
          <span class="flex items-center gap-3">
            <span class="type-label">{@count}</span>
            <.button phx-click="increment">Increment</.button>
          </span>
        </.setting_row>
      </.card>
    </.settings_section>
    """
  end
end
