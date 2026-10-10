defmodule FathomBrowserWeb.BrowserLive do
  @moduledoc """
  The browser dock: tabs, an address bar, and a viewport. The desktop shell
  draws each tab's page in a native webview laid over the viewport; the
  `.Browser` hook tells the shell which tab shows and where, every frame the
  layout moves, and relays page loads, titles, and new-window requests back.

  Annotating runs `priv/annotator.js` in the active tab's page. The hook
  gives the shell that script for every tab, starts and stops it, and listens
  to the active tab only while annotating. Pins on the page follow the notes
  in `FathomBrowser.Annotations`: this view numbers and removes them as the
  notes change, whoever changed them.
  """
  use Fathom.UI, :live_view

  @external_resource annotator = Path.expand("../../priv/annotator.js", __DIR__)
  @annotator File.read!(annotator)

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: FathomBrowser.subscribe()

    {:ok,
     assign(socket,
       browser: FathomBrowser.state(),
       notes: FathomBrowser.annotations(),
       native: nil,
       copied: false,
       agent_error: nil
     )}
  end

  @impl true
  def handle_info({:browser_tabs, browser}, socket),
    do: {:noreply, assign(socket, browser: browser)}

  def handle_info({:browser_annotations, notes}, socket) do
    old = socket.assigns.notes.notes
    keys = MapSet.new(notes.notes, & &1.key)
    old_keys = MapSet.new(old, & &1.key)

    socket =
      Enum.reduce(old, socket, fn note, socket ->
        if MapSet.member?(keys, note.key),
          do: socket,
          else: annotator(socket, note.tab, "unmark", [note.key])
      end)

    socket =
      Enum.reduce(notes.notes, socket, fn note, socket ->
        if MapSet.member?(old_keys, note.key),
          do: socket,
          else: annotator(socket, note.tab, "mark", [note.key, note.n])
      end)

    {:noreply, assign(socket, notes: notes)}
  end

  def handle_info(:copied, socket), do: {:noreply, assign(socket, copied: false)}

  @impl true
  def handle_event("native", %{"available" => available}, socket),
    do: {:noreply, assign(socket, native: available)}

  def handle_event("new_tab", _params, socket) do
    FathomBrowser.open()
    {:noreply, push_event(socket, "browser:focus-address", %{})}
  end

  def handle_event("select", %{"id" => id}, socket) do
    FathomBrowser.activate(String.to_integer(id))
    {:noreply, socket}
  end

  def handle_event("close", %{"id" => id}, socket) do
    FathomBrowser.close(String.to_integer(id))
    {:noreply, socket}
  end

  def handle_event("go", %{"address" => input}, socket) do
    with %{} = tab <- active(socket.assigns.browser),
         url when url != nil <- FathomBrowser.address(input) do
      FathomBrowser.navigate(tab.id, url)
      # A tab that already has a page navigates it; a new tab's page is
      # created at this URL on the next sync.
      socket =
        if tab.url,
          do: push_event(socket, "browser:navigate", %{id: tab.id, url: url}),
          else: socket

      {:noreply, socket}
    else
      _ -> {:noreply, socket}
    end
  end

  def handle_event(action, _params, socket) when action in ~w(back forward reload) do
    case active(socket.assigns.browser) do
      %{url: url} = tab when url != nil ->
        {:noreply, push_event(socket, "browser:history", %{id: tab.id, action: action})}

      _ ->
        {:noreply, socket}
    end
  end

  # Reported by the shell through the hook.
  def handle_event("load", %{"id" => id, "url" => url, "loading" => loading}, socket) do
    FathomBrowser.loaded(id, url, loading)
    {:noreply, socket}
  end

  def handle_event("title", %{"id" => id, "title" => title}, socket) do
    FathomBrowser.titled(id, title)
    {:noreply, socket}
  end

  def handle_event("open", %{"url" => url}, socket) do
    FathomBrowser.open(url)
    {:noreply, socket}
  end

  # Sent by the annotator in the tab the shell is listening to.
  def handle_event("message", %{"id" => id, "message" => message}, socket) do
    case message do
      %{"type" => "annotation", "annotation" => %{} = payload} ->
        FathomBrowser.add_annotation(id, payload)

      %{"type" => "stop"} ->
        FathomBrowser.annotate(false)

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  def handle_event("annotate", _params, socket) do
    FathomBrowser.annotate(not socket.assigns.notes.annotating)
    {:noreply, socket}
  end

  def handle_event("remove_note", %{"n" => n}, socket) do
    FathomBrowser.remove_annotation(String.to_integer(n))
    {:noreply, socket}
  end

  def handle_event("clear_notes", _params, socket) do
    FathomBrowser.clear_annotations()
    {:noreply, socket}
  end

  def handle_event("send_to_agent", _params, socket) do
    with true <- FathomAgent.available?(),
         {:ok, id} <- FathomAgent.create(%{cwd: Fathom.Folder.current()}),
         :ok <- FathomAgent.prompt(id, FathomBrowser.annotations_prompt()) do
      FathomBrowser.clear_annotations()
      FathomAgent.show(id)
      {:noreply, assign(socket, agent_error: nil)}
    else
      {:error, message} -> {:noreply, assign(socket, agent_error: message)}
      false -> {:noreply, assign(socket, agent_error: "No agent is enabled")}
    end
  end

  def handle_event("copied", _params, socket) do
    Process.send_after(self(), :copied, 1500)
    {:noreply, assign(socket, copied: true)}
  end

  defp annotator(socket, tab, function, args) do
    js = "window.__fathomAnnotator?.#{function}(#{Enum.map_join(args, ", ", &Jason.encode!/1)})"
    push_event(socket, "browser:eval", %{id: tab, js: js})
  end

  defp annotator_script, do: @annotator

  defp count([_]), do: "1 annotation"
  defp count(notes), do: "#{length(notes)} annotations"

  defp active(%{tabs: tabs, active: id}), do: Enum.find(tabs, &(&1.id == id))

  defp label(%{title: title}) when is_binary(title), do: title
  defp label(%{url: nil}), do: "New tab"
  defp label(%{url: url}), do: URI.parse(url).host || url

  defp pages(browser),
    do: Jason.encode!(for tab <- browser.tabs, tab.url != nil, do: %{id: tab.id, url: tab.url})

  @impl true
  def render(assigns) do
    assigns = assign(assigns, :tab, active(assigns.browser))

    ~H"""
    <div class="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Browser tabs"
        class="flex h-9 shrink-0 items-end gap-1 border-b border-line px-2"
      >
        <div
          :for={tab <- @browser.tabs}
          role="tab"
          aria-selected={to_string(tab.id == @browser.active)}
          class={[
            "group flex h-7 min-w-0 max-w-48 flex-1 items-center gap-1.5 rounded-t-md border border-b-0 pl-2.5 pr-1 text-sm",
            if(tab.id == @browser.active,
              do: "border-line bg-canvas text-ink",
              else: "border-transparent text-muted hover:text-ink"
            )
          ]}
        >
          <.icon :if={tab.loading} name="ph-circle-notch" class="animate-spin text-xs" />
          <button
            type="button"
            class="min-w-0 flex-1 truncate text-left"
            phx-click="select"
            phx-value-id={tab.id}
            title={tab.url}
          >
            {label(tab)}
          </button>
          <.icon_button
            icon="ph-x"
            label="Close tab"
            class="opacity-60 group-hover:opacity-100"
            phx-click="close"
            phx-value-id={tab.id}
          />
        </div>
        <.icon_button icon="ph-plus" label="New tab" class="mb-0.5" phx-click="new_tab" />
      </div>

      <form phx-submit="go" class="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
        <.icon_button icon="ph-arrow-left" label="Back" phx-click="back" disabled={@tab.url == nil} />
        <.icon_button
          icon="ph-arrow-right"
          label="Forward"
          phx-click="forward"
          disabled={@tab.url == nil}
        />
        <.icon_button
          icon="ph-arrow-clockwise"
          label="Reload"
          phx-click="reload"
          disabled={@tab.url == nil}
        />
        <.input
          id={"browser-address-#{@tab.id}"}
          name="address"
          value={@tab.url}
          placeholder="Search or enter an address"
          autocomplete="off"
          class="ml-1 flex-1"
        />
        <.icon_button
          icon="ph-cursor-click"
          label="Annotate"
          class="ml-1"
          aria-pressed={to_string(@notes.annotating)}
          phx-click="annotate"
          disabled={@tab.url == nil}
        />
      </form>

      <p
        :if={@notes.annotating and @tab.url != nil}
        class="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-info/10 px-3 text-xs text-info"
      >
        <.icon name="ph-cursor-click" class="text-sm" /> Click an element to annotate it. Esc stops.
      </p>

      <div
        id="browser-viewport"
        phx-hook=".Browser"
        data-pages={pages(@browser)}
        data-active={if @tab.url, do: @tab.id}
        data-annotating={to_string(@notes.annotating)}
        data-script={annotator_script()}
        class="relative min-h-0 flex-1 bg-canvas"
      >
        <.empty_state :if={@native == false}>
          The browser needs the Fathom desktop app. Run `mise run dev`.
        </.empty_state>
        <.empty_state :if={@native != false and @tab.url == nil}>
          Enter an address or search above.
        </.empty_state>
      </div>

      <section
        :if={@notes.notes != []}
        aria-label="Annotations"
        class="flex max-h-[40%] shrink-0 flex-col border-t border-line"
      >
        <header class="flex h-10 shrink-0 items-center gap-2 px-3">
          <span class="flex-1 text-sm font-medium">
            {count(@notes.notes)}
          </span>
          <.button phx-click={JS.dispatch("fathom:copy", to: "#browser-annotations-prompt")}>
            <.icon name={if @copied, do: "ph-check", else: "ph-copy"} />
            {if @copied, do: "Copied", else: "Copy for agent"}
          </.button>
          <.button :if={FathomAgent.available?()} variant="primary" phx-click="send_to_agent">
            <.icon name="ph-paper-plane-right" /> Send to agent
          </.button>
          <.button variant="quiet" phx-click="clear_notes">Clear</.button>
        </header>
        <p :if={@agent_error} class="px-3 pb-2 text-xs text-danger">{@agent_error}</p>
        <ol class="min-h-0 overflow-y-auto px-3 pb-2">
          <li
            :for={note <- @notes.notes}
            class="flex items-start gap-2 border-t border-line py-2 first:border-t-0"
          >
            <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info text-[11px] font-semibold text-canvas">
              {note.n}
            </span>
            <div class="min-w-0 flex-1">
              <p :if={note.comment} class="whitespace-pre-line text-sm">{note.comment}</p>
              <p class="truncate font-mono text-xs text-muted" title={note.url}>{note.selector}</p>
              <p :for={style <- note.styles} class="truncate font-mono text-xs text-muted">
                {style.property}: {style.from} → <span class="text-ink">{style.to}</span>
              </p>
              <p :if={note.source && note.source.file} class="truncate font-mono text-xs text-muted">
                {note.source.file}{if note.source.line, do: ":#{note.source.line}"}
              </p>
            </div>
            <.icon_button
              icon="ph-x"
              label="Remove annotation"
              phx-click="remove_note"
              phx-value-n={note.n}
            />
          </li>
        </ol>
        <pre id="browser-annotations-prompt" hidden>{FathomBrowser.Annotations.prompt(@notes.notes)}</pre>
      </section>
    </div>

    <script :type={Phoenix.LiveView.ColocatedHook} name=".Browser">
      // Native webviews sit above the page, so they must follow the viewport's
      // box exactly. A frame loop catches every way it moves: the dock sliding,
      // the window resizing, the layout shifting.
      export default {
        mounted() {
          this.invoke = window.__TAURI_INTERNALS__?.invoke
          this.pushEvent("native", {available: !!this.invoke})
          this.handleEvent("browser:focus-address", () =>
            requestAnimationFrame(() => this.el.parentElement.querySelector("input[name=address]")?.focus()))
          // Runs inside the click, which the clipboard requires.
          this.copy = (event) => navigator.clipboard.writeText(event.target.textContent)
            .then(() => this.pushEvent("copied", {}), (error) => console.error("copy", error))
          window.addEventListener("fathom:copy", this.copy)
          if (!this.invoke) return

          this.pane = this.el.closest("[data-dock-pane]")
          // The shell keeps the script for tabs created later; send it once.
          this.script = this.el.dataset.script
          this.picking = null
          this.relay = ({detail}) => {
            // A new document in the annotated tab starts without the picker.
            if (detail.type === "load" && !detail.loading && detail.id === this.picking) {
              this.eval(detail.id, "window.__fathomAnnotator?.start()")
            }
            this.pushEvent(detail.type, detail)
          }
          window.addEventListener("fathom:browser", this.relay)
          this.handleEvent("browser:navigate", ({id, url}) => this.call({op: "navigate", id, url}))
          this.handleEvent("browser:history", ({id, action}) => this.call({op: action, id}))
          this.handleEvent("browser:eval", ({id, js}) => this.eval(id, js))

          this.bounds = undefined
          this.sync()
          const frame = () => { this.track(); this.frame = requestAnimationFrame(frame) }
          this.frame = requestAnimationFrame(frame)
        },
        updated() { if (this.invoke) this.sync() },
        destroyed() {
          window.removeEventListener("fathom:copy", this.copy)
          if (!this.invoke) return
          cancelAnimationFrame(this.frame)
          window.removeEventListener("fathom:browser", this.relay)
          this.pick(null)
          this.call({op: "bounds", bounds: null})
        },
        call(op) {
          this.invoke("browser", {op}).catch((error) => console.error("browser", op.op, error))
        },
        eval(id, js) {
          this.call({op: "eval", id, js})
        },
        sync() {
          const active = this.el.dataset.active ? Number(this.el.dataset.active) : null
          const script = this.script
          this.script = undefined
          this.call({op: "sync", pages: JSON.parse(this.el.dataset.pages), active, script})
          this.pick(this.el.dataset.annotating === "true" ? active : null)
          this.bounds = undefined
          this.track()
        },
        // Annotates tab `id`, or none.
        pick(id) {
          if (id === this.picking) return
          if (this.picking != null) this.eval(this.picking, "window.__fathomAnnotator?.stop()")
          this.call({op: "listen", id})
          if (id != null) this.eval(id, "window.__fathomAnnotator?.start()")
          this.picking = id
        },
        track() {
          const open = !this.pane || (this.pane.dataset.open === "true" && this.pane.getBoundingClientRect().width > 1)
          const r = this.el.getBoundingClientRect()
          const bounds = open && r.width > 0 && r.height > 0
            ? {x: r.left, y: r.top, width: r.width, height: r.height, page_height: window.innerHeight}
            : null
          if (JSON.stringify(bounds) === JSON.stringify(this.bounds)) return
          this.bounds = bounds
          this.call({op: "bounds", bounds})
        },
      }
    </script>
    """
  end
end
