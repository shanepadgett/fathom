defmodule FathomAgentRuntimeWeb.ChatLive do
  @moduledoc """
  The Chat page: sessions on the left, the selected session's record, and
  a composer.

  The record renders as a stream. Each assistant message is one item that
  holds its tool calls; a call's result or output re-inserts only that
  item. The reply still arriving renders outside the stream from
  `@partial`. Tool cards link files to `Fathom.Folder.open_file/2`.
  """
  use Fathom.UI, :live_view

  alias FathomAgentRuntimeWeb.Markdown

  @output_limit 32_000

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      FathomAgent.subscribe()
      FathomCredentials.subscribe()
      Fathom.Folder.subscribe()
    end

    socket =
      socket
      |> assign(current: nil, meta: nil, status: :idle, partial: nil, seq: 0, count: 0)
      |> assign(item_data: %{}, calls: %{}, results: %{}, outputs: %{}, started: MapSet.new())
      |> assign(models: %{}, choice: saved_choice(), error: nil)
      |> assign_folder()
      |> assign_sessions()
      |> assign_providers()
      |> stream(:items, [])

    {:ok, if(connected?(socket), do: load_models(socket), else: socket)}
  end

  ## Events

  @impl true
  def handle_event("new", _params, socket), do: {:noreply, close_session(socket)}

  def handle_event("select", %{"id" => id}, socket), do: {:noreply, open_session(socket, id)}

  def handle_event("delete", %{"id" => id}, socket) do
    FathomAgent.delete(id)
    socket = if socket.assigns.current == id, do: close_session(socket), else: socket
    {:noreply, socket}
  end

  def handle_event("send", %{"text" => text}, socket) do
    text = String.trim(text)
    %{current: current, choice: choice} = socket.assigns

    cond do
      text == "" ->
        {:noreply, socket}

      choice == nil ->
        {:noreply, assign(socket, error: "Choose a model first.")}

      current == nil ->
        {provider, model} = choice

        case FathomAgent.create(%{cwd: socket.assigns.folder, provider: provider, model: model}) do
          {:ok, id} -> {:noreply, socket |> open_session(id) |> prompt(id, text)}
          {:error, message} -> {:noreply, assign(socket, error: message)}
        end

      true ->
        {:noreply, prompt(socket, current, text)}
    end
  end

  def handle_event("stop", _params, socket) do
    if socket.assigns.current, do: FathomAgent.abort(socket.assigns.current)
    {:noreply, socket}
  end

  def handle_event("model", %{"model" => value}, socket) do
    case String.split(value, "/", parts: 2) do
      [provider, model] ->
        FathomAgentRuntime.choose_model(provider, model)

        if socket.assigns.current,
          do: FathomAgent.set_model(socket.assigns.current, provider, model)

        {:noreply, assign(socket, choice: {provider, model})}

      _ ->
        {:noreply, socket}
    end
  end

  def handle_event("folder", %{"path" => path}, socket) do
    case Fathom.Folder.open(path) do
      :ok -> {:noreply, socket |> assign(error: nil) |> assign_folder()}
      {:error, message} -> {:noreply, assign(socket, error: message)}
    end
  end

  def handle_event("open_file", %{"path" => path} = params, socket) do
    line =
      with l when is_binary(l) <- params["line"],
           {n, ""} <- Integer.parse(l),
           do: n,
           else: (_ -> nil)

    Fathom.Folder.open_file(path, line)
    {:noreply, socket}
  end

  def handle_event("link", %{"href" => "http" <> _ = href}, socket) do
    Fathom.Environment.open_external(href)
    {:noreply, socket}
  end

  def handle_event("link", _params, socket), do: {:noreply, socket}

  ## Messages

  @impl true
  def handle_info({:agent_sessions, :changed}, socket) do
    socket = assign_sessions(socket)

    socket =
      case socket.assigns.current &&
             Enum.find(socket.assigns.sessions, &(&1.id == socket.assigns.current)) do
        nil -> socket
        summary -> assign(socket, meta: summary)
      end

    {:noreply, socket}
  end

  def handle_info({:agent_sessions, {:show, id}}, socket),
    do: {:noreply, open_session(socket, id)}

  def handle_info({:agent, id, seq, event}, %{assigns: %{current: id, seq: last}} = socket)
      when seq > last,
      do: {:noreply, socket |> assign(seq: seq) |> apply_event(event)}

  def handle_info({:agent, _id, _seq, _event}, socket), do: {:noreply, socket}

  def handle_info({:credentials, _}, socket),
    do: {:noreply, socket |> assign_providers() |> load_models()}

  def handle_info({:fathom_folder, {:changed, _path}}, socket),
    do: {:noreply, assign_folder(socket)}

  def handle_info({:fathom_folder, _}, socket), do: {:noreply, socket}

  @impl true
  def handle_async({:models, provider}, {:ok, {:ok, models}}, socket) do
    socket = update(socket, :models, &Map.put(&1, provider, models))
    {:noreply, if(socket.assigns.choice, do: socket, else: default_choice(socket))}
  end

  def handle_async({:models, _provider}, _result, socket), do: {:noreply, socket}

  defp apply_event(socket, {:status, status}) do
    socket = assign(socket, status: status)
    if status == :idle, do: assign(socket, partial: nil), else: socket
  end

  defp apply_event(socket, {:text, text}), do: update_partial(socket, :text, &(&1 <> text))

  defp apply_event(socket, {:thinking, text}),
    do: update_partial(socket, :thinking, &(&1 <> text))

  defp apply_event(socket, {:tool_call, call}),
    do: update_partial(socket, :calls, &(&1 ++ [call]))

  defp apply_event(socket, {:tool_start, id}) do
    socket
    |> update(:started, &MapSet.put(&1, id))
    |> update(:outputs, &Map.put(&1, id, ""))
    |> refresh_call(id)
  end

  defp apply_event(socket, {:tool_output, id, fragment}) do
    socket
    |> update(:outputs, &Map.update(&1, id, fragment, fn text -> tail(text <> fragment) end))
    |> refresh_call(id)
  end

  defp apply_event(socket, {:entry, entry}) do
    socket = insert_entry(socket, entry, socket.assigns.count)
    if entry.role == :assistant, do: assign(socket, partial: nil), else: socket
  end

  defp update_partial(socket, key, fun) do
    partial = socket.assigns.partial || %{text: "", thinking: "", calls: []}
    assign(socket, partial: Map.update!(partial, key, fun))
  end

  ## Sessions

  defp prompt(socket, id, text) do
    case FathomAgent.prompt(id, text) do
      :ok -> socket |> assign(error: nil) |> push_event("composer:clear", %{})
      {:error, message} -> assign(socket, error: message)
    end
  end

  defp close_session(socket) do
    if socket.assigns.current, do: FathomAgent.unsubscribe(socket.assigns.current)

    socket
    |> assign(current: nil, meta: nil, status: :idle, partial: nil, seq: 0, count: 0, error: nil)
    |> assign(item_data: %{}, calls: %{}, results: %{}, outputs: %{}, started: MapSet.new())
    |> stream(:items, [], reset: true)
  end

  defp open_session(socket, id) do
    socket = close_session(socket)
    # Subscribe before the snapshot; `seq` drops what the snapshot already has.
    if connected?(socket), do: FathomAgent.subscribe(id)

    case FathomAgent.session(id) do
      nil ->
        FathomAgent.unsubscribe(id)
        socket

      session ->
        Fathom.Folder.open(session.cwd)
        meta = Map.take(session, [:id, :title, :cwd, :provider, :model, :status, :updated_at])

        socket =
          socket
          |> assign(current: id, meta: meta, status: session.status, seq: session.seq)
          |> assign(partial: session.partial, outputs: session.running)
          |> assign(started: MapSet.new(Map.keys(session.running)))
          |> assign(choice: {session.provider, session.model})

        session.entries
        |> Enum.with_index()
        |> Enum.reduce(socket, fn {entry, i}, socket -> insert_entry(socket, entry, i) end)
    end
  end

  defp insert_entry(socket, entry, index) do
    socket = assign(socket, count: index + 1)

    case entry do
      %{role: :user, content: text} ->
        stream_insert(socket, :items, %{id: "e#{index}", kind: :user, text: text})

      %{role: :notice} = notice ->
        stream_insert(socket, :items, %{
          id: "e#{index}",
          kind: :notice,
          text: notice.content,
          error: notice[:error]
        })

      %{role: :assistant} = message ->
        parts =
          Enum.flat_map(message.content, fn
            %{type: :text, text: text} when text != "" -> [{:text, Markdown.html(text)}]
            %{type: :tool_call, id: id} -> [{:call, id}]
            _ -> []
          end)

        item = %{
          id: "e#{index}",
          kind: :assistant,
          parts: parts,
          thinking: message[:thinking],
          model: message.model,
          usage: message[:usage]
        }

        calls =
          for %{type: :tool_call} = call <- message.content,
              into: socket.assigns.calls,
              do: {call.id, %{call: call, item: index}}

        socket
        |> assign(calls: calls)
        |> update(:item_data, &Map.put(&1, index, item))
        |> insert_item(item)

      %{role: :tool_result, tool_call_id: id} = result ->
        socket
        |> update(:results, &Map.put(&1, id, result))
        |> update(:outputs, &Map.delete(&1, id))
        |> refresh_call(id)
    end
  end

  defp refresh_call(socket, id) do
    with %{item: index} <- socket.assigns.calls[id],
         %{} = item <- socket.assigns.item_data[index],
         do: insert_item(socket, item),
         else: (_ -> socket)
  end

  defp insert_item(socket, item) do
    views = for {:call, id} <- item.parts, into: %{}, do: {id, call_view(socket.assigns, id)}
    stream_insert(socket, :items, Map.put(item, :views, views))
  end

  defp call_view(assigns, id) do
    result = assigns.results[id]

    state =
      cond do
        result && result.error -> :error
        result -> :done
        MapSet.member?(assigns.started, id) -> :running
        true -> :queued
      end

    %{call: assigns.calls[id].call, result: result, output: assigns.outputs[id], state: state}
  end

  ## Assigns

  defp assign_sessions(socket), do: assign(socket, sessions: FathomAgent.sessions())

  defp assign_folder(socket),
    do: assign(socket, folder: Fathom.Folder.current(), recent: Fathom.Folder.recent())

  defp assign_providers(socket),
    do: assign(socket, providers: Enum.filter(FathomCredentials.providers(), & &1.connected))

  defp load_models(socket) do
    Enum.reduce(socket.assigns.providers, socket, fn %{id: id}, socket ->
      start_async(socket, {:models, id}, fn -> FathomLlm.models(id) end)
    end)
  end

  defp saved_choice, do: FathomAgentRuntime.chosen_model()

  defp default_choice(socket) do
    case Enum.find_value(socket.assigns.providers, &socket.assigns.models[&1.id]) do
      [model | _] -> assign(socket, choice: {model.provider, model.id})
      _ -> socket
    end
  end

  defp model_options(assigns) do
    groups =
      for provider <- assigns.providers, models = assigns.models[provider.id], models != [] do
        {provider.label, for(m <- models, do: {m.name, "#{provider.id}/#{m.id}"})}
      end

    listed = for {_, options} <- groups, {_, value} <- options, into: MapSet.new(), do: value

    case assigns.choice do
      {provider, model} ->
        value = "#{provider}/#{model}"
        if MapSet.member?(listed, value), do: groups, else: [{model, value} | groups]

      nil ->
        groups
    end
  end

  defp choice_value({provider, model}), do: "#{provider}/#{model}"
  defp choice_value(nil), do: ""

  defp tail(text) when byte_size(text) > @output_limit,
    do:
      text
      |> binary_part(byte_size(text) - @output_limit, @output_limit)
      |> String.replace_invalid()

  defp tail(text), do: text

  ## Rendering

  @impl true
  def render(assigns) do
    assigns =
      assign(assigns,
        running: assigns.status == :running,
        tool_running: Enum.any?(assigns.started, &(not Map.has_key?(assigns.results, &1))),
        cwd: if(assigns.meta, do: assigns.meta.cwd, else: assigns.folder)
      )

    ~H"""
    <div class="flex min-h-0 min-w-0 flex-1">
      <nav aria-label="Chats" class="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <div class="p-2">
          <.button class="w-full justify-center" phx-click="new">
            <.icon name="ph-plus" /> New chat
          </.button>
        </div>
        <ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <li :for={session <- @sessions} class="group relative">
            <button
              type="button"
              phx-click="select"
              phx-value-id={session.id}
              aria-current={to_string(session.id == @current)}
              class={[
                "flex w-full flex-col rounded-control px-2 py-1.5 pr-7 text-left",
                if(session.id == @current,
                  do: "bg-canvas text-ink",
                  else: "text-muted hover:bg-canvas hover:text-ink"
                )
              ]}
            >
              <span class="flex items-center gap-1.5 truncate text-sm">
                <.status_dot :if={session.status == :running} tone="action" small />
                <span class="truncate">{session.title}</span>
              </span>
              <span class="truncate text-xs text-muted">{Path.basename(session.cwd)}</span>
            </button>
            <.icon_button
              icon="ph-trash"
              label="Delete chat"
              class="absolute top-1.5 right-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
              phx-click="delete"
              phx-value-id={session.id}
              data-confirm="Delete this chat?"
            />
          </li>
        </ul>
      </nav>

      <section class="flex min-h-0 min-w-0 flex-1 flex-col">
        <header class="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
          <h2 class="min-w-0 flex-1 truncate text-sm font-medium">
            {if @meta, do: @meta.title, else: "New chat"}
          </h2>
          <button
            :if={@meta}
            type="button"
            class="flex min-w-0 max-w-64 items-center gap-1 truncate font-mono text-xs text-muted hover:text-ink"
            title={@cwd}
            phx-click="open_file"
            phx-value-path={@cwd}
          >
            <.icon name="ph-folder" class="shrink-0 text-sm" />
            <span class="truncate">{Path.basename(@cwd)}</span>
          </button>
          <form phx-change="model" class="w-64">
            <.select
              name="model"
              class="w-full"
              value={choice_value(@choice)}
              prompt="Choose a model"
              prompt_disabled
              options={model_options(assigns)}
              disabled={@running}
            />
          </form>
        </header>

        <div
          id="chat-messages"
          phx-hook=".Messages"
          class="min-h-0 flex-1 overflow-y-auto"
        >
          <div class="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
            <.new_chat
              :if={@meta == nil}
              folder={@folder}
              recent={@recent}
              providers={@providers}
            />
            <div id="chat-items" phx-update="stream" class="flex flex-col gap-4">
              <div :for={{dom_id, item} <- @streams.items} id={dom_id}>
                <.item item={item} cwd={@cwd} />
              </div>
            </div>
            <.partial :if={@running} partial={@partial} cwd={@cwd} tool_running={@tool_running} />
          </div>
        </div>

        <form
          id="chat-composer"
          phx-submit="send"
          class="shrink-0 border-t border-line bg-surface px-6 py-3"
        >
          <div class="mx-auto flex max-w-3xl flex-col gap-2">
            <.inline_notice :if={@error} error>{@error}</.inline_notice>
            <div class="flex items-end gap-2">
              <textarea
                id="chat-input"
                name="text"
                rows="1"
                phx-hook=".Composer"
                placeholder={
                  if @running, do: "The agent is working…", else: "Ask the agent to do something"
                }
                class="max-h-60 min-h-9 flex-1 resize-none rounded-control border border-control-line bg-canvas px-3 py-2 text-dense text-ink"
              ></textarea>
              <.button :if={@running} phx-click="stop">
                <.icon name="ph-stop" /> Stop
              </.button>
              <.button :if={not @running} type="submit" variant="primary" disabled={@choice == nil}>
                Send
              </.button>
            </div>
            <p class="type-micro">
              Enter sends, Shift+Enter adds a line. Tools run in <span class="font-mono">{@cwd}</span>
              without asking.
            </p>
          </div>
        </form>
      </section>
    </div>

    <script :type={Phoenix.LiveView.ColocatedHook} name=".Messages">
      export default {
        mounted() {
          // Stay at the bottom while the reply grows, unless the person scrolled up.
          this.pinned = true
          this.el.addEventListener("scroll", () => {
            const el = this.el
            this.pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          })
          this.observer = new MutationObserver(() => {
            if (this.pinned) this.el.scrollTop = this.el.scrollHeight
          })
          this.observer.observe(this.el, {childList: true, subtree: true, characterData: true})
          // Links in replies open in the system browser, never in the app window.
          this.el.addEventListener("click", (event) => {
            const link = event.target.closest(".fathom-prose a[href]")
            if (!link) return
            event.preventDefault()
            this.pushEvent("link", {href: link.href})
          })
        },
        destroyed() { this.observer?.disconnect() }
      }
    </script>

    <script :type={Phoenix.LiveView.ColocatedHook} name=".Composer">
      export default {
        mounted() {
          const resize = () => {
            this.el.style.height = "auto"
            this.el.style.height = this.el.scrollHeight + 2 + "px"
          }
          this.el.addEventListener("input", resize)
          this.el.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) return
            event.preventDefault()
            if (this.el.value.trim()) this.el.form.requestSubmit()
          })
          this.handleEvent("composer:clear", () => { this.el.value = ""; resize() })
        }
      }
    </script>

    <script :type={Phoenix.LiveView.ColocatedHook} name=".FolderPicker">
      export default {
        mounted() {
          this.el.addEventListener("click", async () => {
            const invoke = window.__TAURI_INTERNALS__?.invoke
            const current = this.el.dataset.folder
            let path = null
            try {
              path = invoke
                ? await invoke("plugin:dialog|open", {options: {directory: true, multiple: false, defaultPath: current}})
                : window.prompt("Folder", current)
            } catch (error) {
              console.error("folder picker", error)
            }
            if (path) this.pushEvent("folder", {path})
          })
        }
      }
    </script>
    """
  end

  attr :folder, :string, required: true
  attr :recent, :list, required: true
  attr :providers, :list, required: true

  defp new_chat(assigns) do
    ~H"""
    <div class="flex flex-col gap-4 py-8">
      <h3 class="type-section-title">What should the agent work on?</h3>
      <.inline_notice :if={@providers == []}>
        Connect a provider in Settings to choose a model.
      </.inline_notice>
      <div class="flex flex-col gap-2">
        <span class="type-label">Folder</span>
        <div class="flex items-center gap-2">
          <span class="min-w-0 flex-1 truncate rounded-control border border-line bg-surface px-3 py-1.5 font-mono text-xs">
            {@folder}
          </span>
          <.button id="chat-folder-picker" phx-hook=".FolderPicker" data-folder={@folder}>
            <.icon name="ph-folder-open" /> Choose…
          </.button>
        </div>
        <div :if={@recent != []} class="flex flex-wrap gap-1.5">
          <button
            :for={path <- @recent}
            type="button"
            title={path}
            phx-click="folder"
            phx-value-path={path}
            class="rounded-control border border-line px-2 py-0.5 font-mono text-xs text-muted hover:text-ink"
          >
            {Path.basename(path)}
          </button>
        </div>
      </div>
    </div>
    """
  end

  attr :item, :map, required: true
  attr :cwd, :string, required: true

  defp item(%{item: %{kind: :user}} = assigns) do
    ~H"""
    <div class="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-surface px-4 py-2.5 text-dense">
      {@item.text}
    </div>
    """
  end

  defp item(%{item: %{kind: :notice}} = assigns) do
    ~H"""
    <p class={[
      "flex items-start gap-2 text-xs",
      if(@item.error, do: "text-danger", else: "text-muted")
    ]}>
      <.icon name={if @item.error, do: "ph-warning-circle", else: "ph-info"} class="mt-px text-sm" />
      <span class="whitespace-pre-wrap">{@item.text}</span>
    </p>
    """
  end

  defp item(%{item: %{kind: :assistant}} = assigns) do
    ~H"""
    <div class="flex flex-col gap-2">
      <.thinking :if={@item.thinking} text={@item.thinking} />
      <%= for part <- @item.parts do %>
        <div :if={match?({:text, _}, part)} class="fathom-prose">{elem(part, 1)}</div>
        <.tool_card :if={match?({:call, _}, part)} view={@item.views[elem(part, 1)]} cwd={@cwd} />
      <% end %>
      <p
        :if={@item.usage != nil and Enum.any?(@item.parts, &match?({:text, _}, &1))}
        class="type-micro"
      >
        {@item.model} · {@item.usage.input} in · {@item.usage.output} out
      </p>
    </div>
    """
  end

  attr :partial, :map, default: nil
  attr :cwd, :string, required: true
  attr :tool_running, :boolean, default: false

  defp partial(assigns) do
    assigns = assign(assigns, :partial, assigns.partial || %{text: "", thinking: "", calls: []})

    ~H"""
    <div class="flex flex-col gap-2">
      <.thinking :if={@partial.thinking != ""} text={@partial.thinking} open />
      <div :if={@partial.text != ""} class="fathom-prose">
        {Markdown.html(@partial.text, partial: true)}
      </div>
      <.tool_card
        :for={call <- @partial.calls}
        view={%{call: call, result: nil, output: nil, state: :queued}}
        cwd={@cwd}
      />
      <p
        :if={@partial.text == "" and @partial.calls == [] and not @tool_running}
        class="flex items-center gap-2 text-xs text-muted"
      >
        <.icon name="ph-circle-notch" class="animate-spin text-sm" /> Working…
      </p>
    </div>
    """
  end

  attr :text, :string, required: true
  attr :open, :boolean, default: false

  defp thinking(assigns) do
    ~H"""
    <details class="group text-xs text-muted" open={@open} phx-mounted={JS.ignore_attributes("open")}>
      <summary class="flex cursor-pointer list-none items-center gap-1 hover:text-ink">
        <.icon name="ph-caret-right" class="transition-transform group-open:rotate-90" /> Thinking
      </summary>
      <p class="mt-1 whitespace-pre-wrap border-l-2 border-line pl-3">{String.trim(@text)}</p>
    </details>
    """
  end

  attr :view, :map, required: true
  attr :cwd, :string, required: true

  defp tool_card(assigns) do
    %{call: call, result: result, state: state} = assigns.view
    details = (result && result.details) || %{}

    assigns =
      assign(assigns,
        call: call,
        result: result,
        state: state,
        details: details,
        path: path(call, assigns.cwd),
        open: state in [:running, :error] or (call.name in ["bash", "edit"] and state != :queued)
      )

    ~H"""
    <details
      class="group overflow-hidden rounded-control border border-line bg-surface [&_pre]:[font-variant-ligatures:none] [&_.font-mono]:[font-variant-ligatures:none]"
      open={@open}
      phx-mounted={JS.ignore_attributes("open")}
    >
      <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-canvas">
        <.icon name={tool_icon(@call.name)} class="shrink-0 text-base text-muted" />
        <span class="shrink-0 font-medium">{@call.name}</span>
        <span
          class="min-w-0 flex-1 truncate font-mono text-xs text-muted"
          title={summary(@call, @cwd)}
        >
          {summary(@call, @cwd)}
        </span>
        <span :if={@result && @result.duration_ms} class="shrink-0 text-xs text-muted">
          {duration(@result.duration_ms)}
        </span>
        <.state_icon state={@state} />
      </summary>
      <div class="border-t border-line">
        <div :if={@path} class="flex justify-end px-3 pt-2">
          <button
            type="button"
            class="text-xs text-muted hover:text-ink"
            phx-click="open_file"
            phx-value-path={@path}
            phx-value-line={@details["line"] || @details["from"]}
          >
            <.icon name="ph-arrow-square-out" /> Open in editor
          </button>
        </div>
        <.tool_body
          call={@call}
          result={@result}
          output={@view.output}
          details={@details}
          state={@state}
        />
      </div>
    </details>
    """
  end

  attr :state, :atom, required: true

  defp state_icon(%{state: :queued} = assigns),
    do: ~H"""
    <.icon name="ph-clock" class="shrink-0 text-muted" />
    """

  defp state_icon(%{state: :running} = assigns),
    do: ~H"""
    <.icon name="ph-circle-notch" class="shrink-0 animate-spin text-info" />
    """

  defp state_icon(%{state: :done} = assigns),
    do: ~H"""
    <.icon name="ph-check" class="shrink-0 text-success" />
    """

  defp state_icon(%{state: :error} = assigns),
    do: ~H"""
    <.icon name="ph-warning-circle" class="shrink-0 text-danger" />
    """

  attr :call, :map, required: true
  attr :result, :map, default: nil
  attr :output, :string, default: nil
  attr :details, :map, required: true
  attr :state, :atom, required: true

  defp tool_body(%{call: %{name: "edit"}, details: %{"hunks" => [_ | _]}} = assigns) do
    ~H"""
    <div class="max-h-96 overflow-auto py-2 font-mono text-xs leading-5">
      <div :for={{hunk, i} <- Enum.with_index(@details["hunks"])}>
        <div :if={i > 0} class="px-3 text-muted">⋯</div>
        <div
          :for={line <- hunk}
          class={[
            "flex whitespace-pre",
            line["kind"] == "add" && "bg-success/10 text-success",
            line["kind"] == "del" && "bg-danger/10 text-danger"
          ]}
        >
          <span class="w-10 shrink-0 select-none pr-2 text-right text-muted">{line["new"] ||
            line["old"]}</span>
          <span class="w-4 shrink-0 select-none">{marker(line["kind"])}</span>
          <span>{line["text"]}</span>
        </div>
      </div>
    </div>
    """
  end

  defp tool_body(%{call: %{name: "bash"}} = assigns) do
    assigns =
      assign(assigns,
        text: if(assigns.result, do: assigns.result.content, else: assigns.output || "")
      )

    ~H"""
    <div class="px-3 py-2">
      <pre class="mb-2 whitespace-pre-wrap break-all font-mono text-xs text-ink">$ {@call.arguments["command"]}</pre>
      <pre
        :if={@text != ""}
        class={[
          "max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs",
          if(@state == :error, do: "text-danger", else: "text-muted")
        ]}
      >{@text}</pre>
    </div>
    """
  end

  defp tool_body(%{call: %{name: "write"}, details: %{"preview" => preview}} = assigns) do
    assigns =
      assign(assigns, preview: preview |> String.split("\n") |> Enum.take(60) |> Enum.join("\n"))

    ~H"""
    <pre class="max-h-80 overflow-auto px-3 py-2 font-mono text-xs text-muted">{@preview}</pre>
    """
  end

  defp tool_body(%{result: nil} = assigns) do
    ~H"""
    <pre class="max-h-60 overflow-auto px-3 py-2 font-mono text-xs text-muted">{Jason.encode!(@call.arguments, pretty: true)}</pre>
    """
  end

  defp tool_body(assigns) do
    assigns =
      assign(assigns,
        text: assigns.result.content |> String.split("\n") |> Enum.take(80) |> Enum.join("\n")
      )

    ~H"""
    <pre class={[
      "max-h-80 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-xs",
      if(@state == :error, do: "text-danger", else: "text-muted")
    ]}>{@text}</pre>
    """
  end

  defp marker("add"), do: "+"
  defp marker("del"), do: "-"
  defp marker(_), do: " "

  defp tool_icon("read"), do: "ph-file-text"
  defp tool_icon("write"), do: "ph-file-plus"
  defp tool_icon("edit"), do: "ph-pencil-simple"
  defp tool_icon("bash"), do: "ph-terminal-window"
  defp tool_icon(_), do: "ph-wrench"

  defp path(%{name: name, arguments: %{"path" => path}}, cwd)
       when name in ~w(read write edit) and is_binary(path),
       do: Path.expand(path, cwd)

  defp path(_call, _cwd), do: nil

  defp summary(%{name: "bash", arguments: %{"command" => command}}, _cwd) when is_binary(command),
    do: command |> String.split("\n", parts: 2) |> hd()

  defp summary(%{arguments: %{"path" => path}} = call, cwd) when is_binary(path) do
    full = Path.expand(path, cwd)
    shown = if String.starts_with?(full, cwd <> "/"), do: Path.relative_to(full, cwd), else: full

    case call.arguments do
      %{"offset" => offset} -> "#{shown}:#{offset}"
      _ -> shown
    end
  end

  defp summary(%{arguments: arguments}, _cwd),
    do: arguments |> Jason.encode!() |> String.slice(0, 160)

  defp duration(ms) when ms < 1000, do: "#{ms}ms"
  defp duration(ms), do: "#{Float.round(ms / 1000, 1)}s"
end
