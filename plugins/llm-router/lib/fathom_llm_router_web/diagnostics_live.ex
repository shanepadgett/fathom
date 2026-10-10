defmodule FathomLlmRouterWeb.DiagnosticsLive do
  @moduledoc "Settings › Model diagnostics: one streaming request to check a connection."
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      FathomCredentials.subscribe()
      FathomLlmRouter.Checks.subscribe()
    end

    {:ok,
     socket
     |> assign(provider: "", model: "", models: [], loading: false, model_error: nil)
     |> assign(
       prompt: "Reply with one short sentence.",
       check: nil,
       output: "",
       status: "idle",
       error: nil
     )
     |> assign_providers()}
  end

  @impl true
  # Disabled controls are not submitted, so each value falls back to the current one.
  def handle_event("form", params, socket) do
    provider = params["provider"] || socket.assigns.provider
    socket = assign(socket, prompt: params["prompt"] || socket.assigns.prompt)

    if provider == socket.assigns.provider,
      do: {:noreply, assign(socket, model: params["model"] || "")},
      else: {:noreply, socket |> assign(provider: provider, model: "") |> load_models()}
  end

  def handle_event("refresh", _params, socket), do: {:noreply, load_models(socket)}

  def handle_event("send", _params, %{assigns: a} = socket) do
    case FathomLlmRouter.Checks.start(%{provider: a.provider, model: a.model, prompt: a.prompt}) do
      {:ok, id} ->
        {:noreply, assign(socket, check: id, output: "", status: "running", error: nil)}

      {:error, message} ->
        {:noreply, assign(socket, error: message)}
    end
  end

  def handle_event("cancel", _params, socket) do
    if socket.assigns.check, do: FathomLlmRouter.Checks.cancel(socket.assigns.check)
    {:noreply, socket}
  end

  @impl true
  def handle_async(:models, {:ok, {:ok, models}}, socket) do
    model =
      if Enum.any?(models, &(&1.id == socket.assigns.model)), do: socket.assigns.model, else: ""

    {:noreply, assign(socket, models: models, model: model, loading: false, model_error: nil)}
  end

  def handle_async(:models, {:ok, {:error, message}}, socket),
    do: {:noreply, assign(socket, models: [], loading: false, model_error: message)}

  def handle_async(:models, {:exit, reason}, socket),
    do:
      {:noreply,
       assign(socket,
         models: [],
         loading: false,
         model_error: "Model list failed: #{inspect(reason)}"
       )}

  @impl true
  def handle_info({:credentials, _}, socket), do: {:noreply, assign_providers(socket)}

  def handle_info({:llm_check, id, event}, %{assigns: %{check: id}} = socket) do
    case event do
      {:text, text} -> {:noreply, update(socket, :output, &(&1 <> text))}
      :done -> {:noreply, assign(socket, status: "done")}
      :cancelled -> {:noreply, assign(socket, status: "cancelled")}
      {:error, message} -> {:noreply, assign(socket, status: "error", error: message)}
    end
  end

  def handle_info({:llm_check, _id, _event}, socket), do: {:noreply, socket}

  defp assign_providers(socket),
    do: assign(socket, providers: Enum.filter(FathomCredentials.providers(), & &1.connected))

  defp load_models(%{assigns: %{provider: ""}} = socket),
    do: assign(socket, models: [], model_error: nil)

  defp load_models(socket) do
    provider = socket.assigns.provider

    socket
    |> assign(loading: true, model_error: nil)
    |> start_async(:models, fn -> FathomLlm.models(provider) end)
  end

  defp model_placeholder(%{provider: ""}), do: "Choose a provider first"
  defp model_placeholder(%{loading: true}), do: "Loading models…"
  defp model_placeholder(%{models: []}), do: "No models available"
  defp model_placeholder(_), do: "Choose a model"

  @impl true
  def render(assigns) do
    assigns = assign(assigns, running: assigns.status == "running")

    ~H"""
    <.settings_section
      title="Model diagnostics"
      description="One streaming request to check a provider connection. This is not a conversation."
    >
      <form id="model-check" class="grid gap-6" phx-change="form" phx-submit="send">
        <.inline_notice :if={@error} error>{@error}</.inline_notice>
        <div class="grid grid-cols-2 gap-4">
          <.field id="model-provider" label="Provider">
            <.select
              id="model-provider"
              name="provider"
              class="w-full"
              value={@provider}
              disabled={@running}
              prompt="Choose a connected provider"
              options={for p <- @providers, do: {p.label, p.id}}
            />
          </.field>
          <.field id="model-selection" label="Model">
            <.select
              id="model-selection"
              name="model"
              class="w-full"
              value={@model}
              disabled={@provider == "" or @loading or @models == [] or @running}
              prompt={model_placeholder(assigns)}
              prompt_disabled
              options={for m <- @models, do: {m.name, m.id}}
            />
          </.field>
        </div>
        <div class="flex items-center gap-3">
          <.button phx-click="refresh" disabled={@provider == "" or @loading or @running}>
            Refresh models
          </.button>
          <.inline_notice :if={@provider != "" and not @loading}>
            {length(@models)} models
          </.inline_notice>
        </div>
        <.inline_notice :if={@model_error} error>{@model_error}</.inline_notice>
        <.field id="model-prompt" label="Prompt">
          <.textarea id="model-prompt" name="prompt" rows="4" value={@prompt} disabled={@running} />
        </.field>
        <div class="flex items-center gap-3">
          <.button
            type="submit"
            variant="primary"
            disabled={@provider == "" or @model == "" or String.trim(@prompt) == "" or @running}
          >
            Send request
          </.button>
          <.button :if={@running} phx-click="cancel">Cancel</.button>
          <span class="type-description" role="status">{@status}</span>
        </div>
      </form>
      <.card :if={@output != ""} class="mt-6">
        <pre
          class="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-sm"
          aria-live="polite"
        >{@output}</pre>
      </.card>
    </.settings_section>
    """
  end
end
