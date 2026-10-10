defmodule FathomPluginManagerWeb.PluginsLive do
  @moduledoc """
  Settings › Plugins: every plugin's state, dependencies, and controls, and
  the local plugins Fathom builds from `~/.fathom/plugins`.
  """
  use Fathom.UI, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: Fathom.KernelControl.subscribe()

    {:ok,
     socket
     |> assign(message: nil, error: false, editing: nil, creating: false, create_error: nil)
     |> assign_plugins()}
  end

  @impl true
  def handle_info({:fathom_kernel, :changed}, socket), do: {:noreply, assign_plugins(socket)}

  @impl true
  def handle_event("change", %{"id" => id, "action" => action}, socket) do
    action =
      Map.fetch!(%{"enable" => :enable, "disable" => :disable, "restart" => :restart}, action)

    {:noreply, socket |> apply_change(id, action) |> assign_plugins()}
  end

  def handle_event("restart_stale", _params, socket) do
    socket =
      case Fathom.KernelControl.restart_stale() do
        :ok -> assign(socket, message: "Restarted changed plugins", error: false)
        {:error, message} -> assign(socket, message: message, error: true)
      end

    {:noreply, assign_plugins(socket)}
  end

  def handle_event("rebuild", _params, socket) do
    Fathom.KernelControl.rebuild()
    {:noreply, socket}
  end

  def handle_event("configure", %{"id" => id}, socket),
    do: {:noreply, assign(socket, editing: id)}

  def handle_event("new", _params, socket),
    do: {:noreply, assign(socket, creating: true, create_error: nil)}

  def handle_event("close", _params, socket),
    do: {:noreply, assign(socket, editing: nil, creating: false)}

  def handle_event("save", %{"config" => config}, socket) do
    id = socket.assigns.editing

    {:noreply,
     socket
     |> assign(editing: nil)
     |> apply_change(id, {:configure, config})
     |> assign_plugins()}
  end

  def handle_event("create", %{"name" => name, "ui" => ui}, socket) do
    name = String.trim(name)

    case Fathom.KernelControl.create(name, ui) do
      :ok ->
        {:noreply,
         assign(socket,
           creating: false,
           message: "Created #{name}. Fathom builds it now; edit it and save to see changes.",
           error: false
         )}

      {:error, message} ->
        {:noreply, assign(socket, create_error: message)}
    end
  end

  defp apply_change(socket, id, action) do
    label = action |> then(&if(is_tuple(&1), do: :configure, else: &1)) |> Atom.to_string()

    case Fathom.KernelControl.change(id, action) do
      :ok ->
        assign(socket, message: "#{label}: #{id} completed", error: false)

      {:error, message} ->
        assign(socket, message: "#{label}: #{id} failed. #{message}", error: true)
    end
  end

  defp assign_plugins(socket) do
    plugins = Fathom.KernelControl.plugins()

    assign(socket,
      plugins: plugins,
      stale: Enum.filter(plugins, & &1.stale),
      builds: Fathom.KernelControl.builds()
    )
  end

  @impl true
  def render(assigns) do
    assigns = assign(assigns, :plugin, Enum.find(assigns.plugins, &(&1.id == assigns.editing)))

    ~H"""
    <.settings_section
      title="Plugins"
      description="Every feature is a plugin. Disabling one stops the plugins that depend on it."
    >
      <div class="grid gap-4">
        <.inline_notice :if={@message} error={@error}>{@message}</.inline_notice>
        <div
          :if={@stale != []}
          class="flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-3"
        >
          <span class="type-description">
            {changed_label(@stale)} Restart to apply manifest or application changes.
          </span>
          <.button variant="primary" phx-click="restart_stale">Restart</.button>
        </div>
        <.card padding="rows">
          <div
            :for={plugin <- @plugins}
            id={"plugin-#{plugin.id}"}
            class="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <.status_dot tone={tone(plugin)} label={state_label(plugin)} />
                <span class="type-label">{plugin.id}</span>
                <span
                  :if={plugin.source == :local}
                  class="rounded-sm border border-line px-1.5 type-micro text-muted"
                >
                  Local
                </span>
                <span class="type-micro text-muted">gen {plugin.gen}</span>
              </div>
              <p class="mt-1 type-description">{describe(plugin)}</p>
              <p :if={plugin.dir} class="mt-1 type-micro text-muted">{plugin.dir}</p>
              <p :if={plugin.provides != []} class="mt-1 type-micro text-muted">
                Provides {tokens(plugin.provides)}
              </p>
              <p :if={plugin.requires != []} class="type-micro text-muted">
                Requires {tokens(plugin.requires)}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <.button
                :if={plugin.state == :failed or plugin.stale}
                phx-click="change"
                phx-value-id={plugin.id}
                phx-value-action="restart"
              >
                Restart
              </.button>
              <.button
                phx-click="change"
                phx-value-id={plugin.id}
                phx-value-action={if plugin.enabled, do: "disable", else: "enable"}
              >
                {if plugin.enabled, do: "Disable", else: "Enable"}
              </.button>
              <.button :if={plugin.config_schema != []} phx-click="configure" phx-value-id={plugin.id}>
                Configure
              </.button>
            </div>
          </div>
        </.card>
        <.local_plugins builds={@builds} />
      </div>
      <.dialog
        id="configure-plugin"
        title={"Configure #{@editing}"}
        show={@plugin != nil}
        on_close="close"
      >
        <.config_form :if={@plugin} plugin={@plugin} />
      </.dialog>
      <.dialog id="new-plugin" title="New local plugin" show={@creating} on_close="close">
        <form id="new-plugin-form" class="grid gap-4" phx-submit="create">
          <.inline_notice :if={@create_error} error>{@create_error}</.inline_notice>
          <.field
            id="new-plugin-name"
            label="Name"
            description={"Lowercase letters, digits, and dashes. Created in #{@builds.root}."}
          >
            <.input id="new-plugin-name" name="name" value="" placeholder="my-plugin" required />
          </.field>
          <.field id="new-plugin-ui" label="Contributes">
            <.select
              id="new-plugin-ui"
              name="ui"
              value="settings"
              options={[
                {"A settings section", "settings"},
                {"A workspace page", "page"},
                {"Nothing yet", "none"}
              ]}
            />
          </.field>
          <div><.button type="submit" variant="primary">Create plugin</.button></div>
        </form>
      </.dialog>
    </.settings_section>
    """
  end

  attr :builds, :map, required: true

  defp local_plugins(assigns) do
    assigns =
      assign(assigns,
        failed: Enum.filter(assigns.builds.plugins, & &1.error),
        warned: Enum.filter(assigns.builds.plugins, &(&1.error == nil and &1.diagnostics != []))
      )

    ~H"""
    <.card>
      <div id="local-plugins" class="grid gap-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <.status_dot tone={build_tone(@builds, @failed)} label={build_label(@builds, @failed)} />
              <span class="type-label">Local plugins</span>
            </div>
            <p class="mt-1 type-description">
              Mix projects in <span class="type-code">{@builds.root}</span>.
              Edit them, then press Reload.
            </p>
            <p :if={@builds.pending != []} class="mt-1 type-micro text-action">
              Changed since the last build: {Enum.join(@builds.pending, ", ")}
            </p>
            <p class="mt-1 type-micro text-muted">{build_label(@builds, @failed)}</p>
          </div>
          <div class="flex items-center gap-2">
            <.button phx-click="new">New plugin</.button>
            <.button
              phx-click="rebuild"
              variant={if @builds.pending != [], do: "primary", else: "secondary"}
              disabled={@builds.state == :building}
            >
              Reload
            </.button>
          </div>
        </div>
        <.inline_notice :if={@builds.error} error>{@builds.error}</.inline_notice>
        <.inline_notice :if={@builds.css_error} error>
          Plugin CSS did not build. {@builds.css_error}
        </.inline_notice>
        <div
          :for={build <- @failed}
          id={"build-#{build.name}"}
          class="grid gap-2 rounded-md border border-line p-3"
        >
          <div class="flex items-center gap-2">
            <.status_dot tone="danger" label="Build failed" />
            <span class="type-label">{build.name}</span>
            <span :if={build.plugin} class="type-micro text-muted">
              The previous build keeps running.
            </span>
          </div>
          <pre class="overflow-x-auto whitespace-pre-wrap type-code">{build.error}</pre>
          <ul :if={length(build.diagnostics) > 1} class="grid gap-1">
            <li :for={d <- build.diagnostics} class="type-micro text-muted">
              {d.severity}: {d.file}{if d.line, do: ":#{d.line}"} {first_line(d.message)}
            </li>
          </ul>
        </div>
        <details :for={build <- @warned} id={"warnings-#{build.name}"}>
          <summary class="cursor-pointer type-micro text-muted">
            {build.name}: {length(build.diagnostics)} compiler {if length(build.diagnostics) == 1,
              do: "warning",
              else: "warnings"}
          </summary>
          <ul class="mt-2 grid gap-2">
            <li :for={d <- build.diagnostics}>
              <span class="type-micro text-muted">{d.file}{if d.line, do: ":#{d.line}"}</span>
              <pre class="overflow-x-auto whitespace-pre-wrap type-code">{d.message}</pre>
            </li>
          </ul>
        </details>
        <details :if={@builds.log != ""}>
          <summary class="cursor-pointer type-micro text-muted">Build log</summary>
          <pre class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap type-code">{@builds.log}</pre>
        </details>
      </div>
    </.card>
    """
  end

  attr :plugin, :map, required: true

  defp config_form(assigns) do
    ~H"""
    <form id="plugin-config" class="grid gap-4" phx-submit="save">
      <.field
        :for={{key, spec} <- @plugin.config_schema}
        id={"config-#{key}"}
        label={Phoenix.Naming.humanize(key)}
        description={spec[:doc]}
      >
        <.config_input key={key} spec={spec} value={value(@plugin, key, spec)} />
      </.field>
      <div><.button type="submit" variant="primary">Save and restart</.button></div>
    </form>
    """
  end

  attr :key, :atom, required: true
  attr :spec, :list, required: true
  attr :value, :any, default: nil

  defp config_input(%{spec: spec} = assigns) do
    case spec[:type] do
      :boolean ->
        ~H"""
        <input type="hidden" name={"config[#{@key}]"} value="false" />
        <.switch
          id={"config-#{@key}"}
          label={to_string(@key)}
          name={"config[#{@key}]"}
          value="true"
          checked={@value == true}
        />
        """

      {:in, choices} ->
        assigns = assign(assigns, :choices, choices)

        ~H"""
        <.select
          id={"config-#{@key}"}
          name={"config[#{@key}]"}
          value={@value}
          options={for c <- @choices, do: {to_string(c), to_string(c)}}
        />
        """

      type when type in [:integer, :pos_integer, :non_neg_integer, :float] ->
        ~H"""
        <.input id={"config-#{@key}"} type="number" name={"config[#{@key}]"} value={@value} />
        """

      _ ->
        ~H"""
        <.input id={"config-#{@key}"} name={"config[#{@key}]"} value={@value} />
        """
    end
  end

  defp value(plugin, key, spec), do: Map.get(plugin.config, Atom.to_string(key), spec[:default])

  defp tokens(tokens), do: Enum.map_join(tokens, ", ", &inspect/1)

  defp changed_label([_]), do: "1 plugin changed."
  defp changed_label(stale), do: "#{length(stale)} plugins changed."

  defp first_line(text), do: text |> String.split("\n", parts: 2) |> hd()

  defp tone(%{stale: true}), do: "action"
  defp tone(%{state: :ready}), do: "success"
  defp tone(%{state: :failed}), do: "danger"
  defp tone(%{state: :blocked}), do: "warning"
  defp tone(_), do: "neutral"

  defp state_label(%{stale: true}), do: "Changed"
  defp state_label(plugin), do: plugin.state |> Atom.to_string() |> String.capitalize()

  defp describe(%{stale: true}), do: "Changed. Restart to apply."
  defp describe(%{state: :blocked, waiting_on: waiting}), do: "Waiting on " <> tokens(waiting)
  defp describe(%{state: :failed, last_error: error}), do: "Failed: #{error}"
  defp describe(%{state: :stopped}), do: "Disabled"
  defp describe(%{state: :ready}), do: "Running"
  defp describe(%{state: state}), do: state_label(%{stale: false, state: state})

  defp build_tone(%{state: :building}, _), do: "action"
  defp build_tone(%{error: error}, failed) when error != nil or failed != [], do: "danger"
  defp build_tone(_, _), do: "success"

  defp build_label(%{state: :building}, _), do: "Building…"
  defp build_label(%{finished_at: nil}, _), do: "Not built yet"
  defp build_label(%{error: error}, _) when error != nil, do: "Build failed"

  defp build_label(builds, failed) do
    built = length(builds.plugins) - length(failed)
    time = Calendar.strftime(builds.finished_at, "%H:%M:%S UTC")

    case failed do
      [] -> "Built #{built} at #{time}"
      _ -> "Built #{built}, #{length(failed)} failed, at #{time}"
    end
  end
end
