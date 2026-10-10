defmodule FathomCredentialsLocalWeb.ProvidersLive do
  @moduledoc "Settings › Providers: connect, sign in, and sign out."
  use Fathom.UI, :live_view

  alias FathomCredentialsLocal.LoginState

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      FathomCredentialsLocal.subscribe()
      FathomCredentials.Logins.subscribe()
    end

    {:ok,
     socket
     |> assign(selected: nil, error: nil, logins: latest(FathomCredentialsLocal.logins()))
     |> assign_providers()}
  end

  @impl true
  def handle_info({:credentials, :changed}, socket), do: {:noreply, assign_providers(socket)}

  def handle_info({:credentials_local, {:login, %LoginState{} = login}}, socket) do
    {:noreply, update(socket, :logins, &Map.put(&1, login.provider, login))}
  end

  def handle_info({:fathom_registry, _}, socket), do: {:noreply, assign_providers(socket)}

  @impl true
  def handle_event("select", %{"id" => id}, socket),
    do: {:noreply, assign(socket, selected: id, error: nil)}

  def handle_event("login", %{"method" => method}, socket),
    do: {:noreply, result(socket, FathomCredentialsLocal.start_login(current(socket).id, method))}

  def handle_event("connect", %{"key" => key}, socket),
    do:
      {:noreply, result(socket, FathomCredentialsLocal.connect_api_key(current(socket).id, key))}

  def handle_event("remove", _params, socket),
    do: {:noreply, result(socket, FathomCredentialsLocal.remove(current(socket).id))}

  def handle_event("reply", %{"login" => id, "reply" => value}, socket),
    do: {:noreply, result(socket, FathomCredentialsLocal.reply(id, value))}

  def handle_event("cancel", %{"id" => id}, socket),
    do: {:noreply, result(socket, FathomCredentialsLocal.cancel(id))}

  def handle_event("open", %{"id" => id}, socket),
    do: {:noreply, result(socket, FathomCredentialsLocal.open(id))}

  defp result(socket, {:error, message}), do: assign(socket, error: message)
  defp result(socket, _ok), do: assign(socket, error: nil)

  defp assign_providers(socket), do: assign(socket, providers: FathomCredentialsLocal.providers())

  defp latest(logins), do: Map.new(logins, &{&1.provider, &1})

  defp current(%{assigns: assigns}), do: current(assigns.providers, assigns.selected)

  defp current(providers, selected),
    do: Enum.find(providers, &(&1.id == selected)) || List.first(providers)

  @impl true
  def render(assigns) do
    assigns = assign(assigns, :provider, current(assigns.providers, assigns.selected))

    ~H"""
    <div class="flex min-h-full">
      <nav aria-label="Providers" class="w-48 shrink-0 overflow-auto border-r border-line">
        <.nav_item
          :for={item <- @providers}
          label={item.label}
          current={@provider && item.id == @provider.id}
          phx-click="select"
          phx-value-id={item.id}
        >
          <:trailing>
            <.status_dot
              tone={if item.connected, do: "success", else: "neutral"}
              small
              label={if item.connected, do: "Connected", else: "Not connected"}
            />
          </:trailing>
        </.nav_item>
      </nav>
      <div class="min-w-0 flex-1">
        <div :if={@error} class="px-10 pt-8">
          <.inline_notice error>{@error}</.inline_notice>
        </div>
        <%= if @provider do %>
          <.connection provider={@provider} login={@logins[@provider.id]} />
        <% else %>
          <.empty_state>Enable a provider plugin to set up a connection.</.empty_state>
        <% end %>
      </div>
    </div>
    """
  end

  attr :provider, :map, required: true
  attr :login, :any, default: nil

  defp connection(assigns) do
    assigns =
      assign(assigns,
        pending: assigns.login != nil and LoginState.active?(assigns.login),
        oauth: assigns.provider.kind == :oauth,
        sign_in: Enum.reject(assigns.provider.methods, &(&1.id == "api-key")),
        api_key: Enum.any?(assigns.provider.methods, &(&1.id == "api-key"))
      )

    ~H"""
    <.settings_section>
      <header class="mb-8 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface font-mono text-lg">
            {String.first(@provider.label)}
          </span>
          <h1 class="type-title">{@provider.label}</h1>
        </div>
        <span class="inline-flex items-center gap-2 type-description">
          {if @provider.connected,
            do: "Connected · #{if @oauth, do: "OAuth", else: "API key"}",
            else: "Not connected"}
        </span>
      </header>
      <section aria-label="Connection">
        <%= if @provider.connected and not @pending do %>
          <div class="flex flex-wrap items-center justify-between gap-4 py-4">
            <span class="text-sm">
              {if @oauth, do: "Signed in with OAuth", else: "Connected with an API key"}
            </span>
            <.button phx-click="remove">{if @oauth, do: "Sign out", else: "Remove key"}</.button>
          </div>
        <% else %>
          <div
            :for={method <- @sign_in}
            class="flex flex-wrap items-center justify-between gap-4 py-4"
          >
            <span class="text-sm">{method.label}</span>
            <.button disabled={@pending} phx-click="login" phx-value-method={method.id}>
              <.icon name="ph-arrow-square-out" /> {method.label}
            </.button>
          </div>
          <div :if={@sign_in != [] and @api_key} class="my-6 flex items-center gap-3 type-micro">
            <span class="h-px flex-1 bg-line"></span> OR <span class="h-px flex-1 bg-line"></span>
          </div>
          <form :if={@api_key} id={"api-key-#{@provider.id}"} phx-submit="connect">
            <.field id="provider-api-key" label="API key">
              <div class="flex items-center gap-3">
                <.input
                  id="provider-api-key"
                  name="key"
                  type="password"
                  autocomplete="off"
                  required
                  placeholder="Paste API key"
                  class="flex-1"
                />
                <.button type="submit" variant="primary">Connect</.button>
              </div>
            </.field>
          </form>
        <% end %>
        <.login_status :if={@login && @login.state != :connected} login={@login} />
      </section>
    </.settings_section>
    """
  end

  attr :login, LoginState, required: true

  defp login_status(assigns) do
    assigns = assign(assigns, :waiting, assigns.login.state == :waiting)

    ~H"""
    <div class="mt-4 grid gap-3">
      <.inline_notice error={@login.state == :failed}>{@login.message}</.inline_notice>
      <div
        :if={@login.code && @waiting}
        class="my-6 flex items-center gap-4 rounded-control border border-control-line bg-canvas px-4 py-3"
        aria-label="Device sign-in code"
      >
        <code class="select-all font-mono text-2xl tracking-wide">{@login.code}</code>
      </div>
      <div :if={@login.url && @waiting}>
        <.button variant="primary" phx-click="open" phx-value-id={@login.id}>
          <.icon name="ph-arrow-square-out" /> Open sign-in page
        </.button>
      </div>
      <form
        :if={@waiting && @login.prompt}
        id={"reply-#{@login.id}"}
        class="grid gap-3"
        phx-submit="reply"
      >
        <input type="hidden" name="login" value={@login.id} />
        <.field id={"reply-input-#{@login.id}"} label={@login.prompt}>
          <.input
            id={"reply-input-#{@login.id}"}
            name="reply"
            type="password"
            autocomplete="off"
            required
            placeholder="Paste callback URL or code"
          />
        </.field>
        <div><.button type="submit" variant="primary">Continue</.button></div>
      </form>
      <div :if={LoginState.active?(@login)}>
        <.button variant="quiet" phx-click="cancel" phx-value-id={@login.id}>Cancel login</.button>
      </div>
    </div>
    """
  end
end
