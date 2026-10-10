defmodule FathomWorkspaceWeb.GeneralLive do
  @moduledoc "General settings. Appearance is browser-local, so the page holds it."
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket), do: {:ok, socket}

  @impl true
  def render(assigns) do
    ~H"""
    <.settings_section>
      <section aria-labelledby="appearance-title">
        <h2 id="appearance-title" class="type-section-title mb-3">Appearance</h2>
        <.card padding="rows">
          <.setting_row label="Theme" description="Choose how your workspace looks.">
            <.appearance_control preference="theme" class="w-44 shrink-0" />
          </.setting_row>
          <.setting_row
            label="Reduce motion"
            description="Keep transitions and animations to a minimum."
          >
            <.appearance_control preference="motion" />
          </.setting_row>
        </.card>
      </section>
    </.settings_section>
    """
  end
end
