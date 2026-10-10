defmodule FathomEditorWeb.EditorLive do
  @moduledoc """
  The editor dock: the current folder's tree, open files as tabs, and a
  CodeMirror view per open file in the `.Editor` hook.

  Text lives in the hook while a file is open. Unsaved text also goes to
  `FathomEditor.Tabs` (debounced), so it survives this view going away.
  Files changed on disk reload when clean and show a notice when not.

  Language servers run per view: the hook asks with `lsp_start`, this
  view starts `FathomEditor.LanguageServer` and relays JSON-RPC bodies
  both ways as `lsp_send` and `lsp:message`.
  """
  use Fathom.UI, :live_view

  alias FathomEditor.{Files, LanguageServer, Servers, Tabs}

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Tabs.subscribe()
      Fathom.Folder.subscribe()
    end

    tabs = Tabs.state()

    socket =
      socket
      |> assign(tabs: tabs, loaded: MapSet.new(), servers: %{}, lsp: %{}, notice: nil)
      |> assign_root(Fathom.Folder.current())

    socket =
      if connected?(socket),
        do:
          Enum.reduce(tabs.tabs, socket, &load(&2, &1.path, nil)) |> show(tabs.active, tabs.line),
        else: socket

    {:ok, socket}
  end

  ## Tree and tabs

  @impl true
  def handle_event("toggle", %{"path" => path}, socket) do
    if MapSet.member?(socket.assigns.expanded, path) do
      {:noreply, update(socket, :expanded, &MapSet.delete(&1, path))}
    else
      {:noreply,
       socket
       |> update(:expanded, &MapSet.put(&1, path))
       |> update(:entries, &Map.put(&1, path, Files.list(path)))}
    end
  end

  def handle_event("open", %{"path" => path}, socket) do
    Tabs.open(path)
    {:noreply, socket}
  end

  def handle_event("activate", %{"path" => path}, socket) do
    Tabs.activate(path)
    {:noreply, show(socket, path)}
  end

  def handle_event("close", %{"path" => path}, socket) do
    Tabs.close(path)

    {:noreply,
     socket
     |> update(:loaded, &MapSet.delete(&1, path))
     |> push_event("editor:close", %{path: path})}
  end

  def handle_event("refresh", _params, socket),
    do: {:noreply, assign_root(socket, socket.assigns.root)}

  ## From the hook

  def handle_event("save", %{"path" => path, "content" => content}, socket) do
    case Files.write(path, content) do
      :ok ->
        Tabs.buffer(path, nil)
        # CodeMirror's client does not know about saves; servers rebuild on them.
        notify(socket, path, "textDocument/didSave", %{textDocument: %{uri: Files.uri(path)}})

        {:noreply,
         socket
         |> assign(notice: nil)
         |> push_event("editor:saved", %{path: path, content: content})}

      {:error, message} ->
        {:noreply, assign(socket, notice: message)}
    end
  end

  def handle_event("buffer", %{"path" => path, "content" => content}, socket) do
    Tabs.buffer(path, content)
    {:noreply, socket}
  end

  def handle_event("clean", %{"path" => path}, socket) do
    Tabs.buffer(path, nil)
    {:noreply, socket}
  end

  def handle_event("reload", %{"path" => path}, socket) do
    Tabs.buffer(path, nil)
    {:noreply, push_disk(socket, path, true)}
  end

  def handle_event("lsp_start", %{"language" => language, "path" => path}, socket) do
    root = Servers.root(language, path, socket.assigns.root)
    key = {language, root}

    case socket.assigns.servers[key] do
      %{id: id} ->
        {:noreply,
         push_event(socket, "lsp:ready", %{
           language: language,
           root: root,
           server: id,
           root_uri: Files.uri(root)
         })}

      nil ->
        {:noreply, start_server(socket, language, root)}
    end
  end

  def handle_event("lsp_send", %{"server" => id, "message" => body}, socket) do
    case Enum.find(socket.assigns.servers, fn {_, s} -> s.id == id end) do
      {_, %{pid: pid}} -> LanguageServer.send_message(pid, body)
      nil -> :ok
    end

    {:noreply, socket}
  end

  ## Messages

  @impl true
  def handle_info({:editor_tabs, tabs}, socket), do: {:noreply, assign(socket, tabs: tabs)}

  def handle_info({:editor_open, path, line}, socket) do
    socket =
      if MapSet.member?(socket.assigns.loaded, path), do: socket, else: load(socket, path, line)

    {:noreply, show(socket, path, line)}
  end

  def handle_info({:editor_disk, path}, socket) do
    if MapSet.member?(socket.assigns.loaded, path),
      do: {:noreply, push_disk(socket, path, false)},
      else: {:noreply, socket}
  end

  # Servers learn about files changed outside the editor, such as by an agent.
  def handle_info({:editor_changed, paths}, socket) do
    Enum.each(socket.assigns.servers, fn {{_language, root}, %{pid: pid}} ->
      changes =
        for p <- paths,
            String.starts_with?(p, root <> "/"),
            do: %{uri: Files.uri(p), type: if(File.exists?(p), do: 2, else: 3)}

      if changes != [],
        do:
          LanguageServer.send_message(
            pid,
            rpc("workspace/didChangeWatchedFiles", %{changes: changes})
          )
    end)

    {:noreply, socket}
  end

  def handle_info({:editor_tree, dir}, socket) do
    if Map.has_key?(socket.assigns.entries, dir),
      do: {:noreply, update(socket, :entries, &Map.put(&1, dir, Files.list(dir)))},
      else: {:noreply, socket}
  end

  def handle_info({:fathom_folder, {:changed, root}}, socket),
    do: {:noreply, assign_root(socket, root)}

  def handle_info({:fathom_folder, _}, socket), do: {:noreply, socket}

  def handle_info({:lsp, id, body}, socket),
    do: {:noreply, push_event(socket, "lsp:message", %{server: id, message: body})}

  def handle_info({:lsp_exit, id, status}, socket) do
    {key, _} = Enum.find(socket.assigns.servers, {nil, nil}, fn {_, s} -> s.id == id end)

    {:noreply,
     socket
     |> update(:servers, &Map.delete(&1, key))
     |> put_lsp(key, "stopped (exit #{status})")
     |> push_event("lsp:exit", %{server: id})}
  end

  @impl true
  def handle_async({:install, language, root}, {:ok, {:ok, _path}}, socket),
    do: {:noreply, start_server(socket, language, root)}

  def handle_async({:install, language, root}, {:ok, {:error, message}}, socket),
    do: {:noreply, put_lsp(socket, {language, root}, message)}

  def handle_async({:install, language, root}, {:exit, reason}, socket),
    do: {:noreply, put_lsp(socket, {language, root}, "install failed: #{inspect(reason)}")}

  ## Helpers

  defp assign_root(socket, root) do
    assign(socket, root: root, expanded: MapSet.new([root]), entries: %{root => Files.list(root)})
  end

  # Sends a file to the hook: unsaved text when there is some, else the disk's.
  defp load(socket, path, line) do
    case Files.read(path) do
      {:ok, disk} ->
        content = Map.get(socket.assigns.tabs.buffers, path, disk)

        socket
        |> update(:loaded, &MapSet.put(&1, path))
        |> push_event("editor:open", %{
          path: path,
          uri: Files.uri(path),
          language: Files.language(path),
          content: content,
          disk: disk,
          line: line
        })

      {:error, message} ->
        Tabs.close(path)
        assign(socket, notice: message)
    end
  end

  defp show(socket, path, line \\ nil)
  defp show(socket, nil, _line), do: socket
  defp show(socket, path, line), do: push_event(socket, "editor:show", %{path: path, line: line})

  defp push_disk(socket, path, force?) do
    case Files.read(path) do
      {:ok, content} ->
        push_event(socket, "editor:disk", %{path: path, content: content, force: force?})

      {:error, _} ->
        socket
    end
  end

  defp start_server(socket, language, root) do
    key = {language, root}

    case Servers.command(language) do
      {:ok, command, args, name} ->
        id = "#{language}-#{System.unique_integer([:positive])}"

        {:ok, pid} =
          LanguageServer.start(%{id: id, owner: self(), command: command, args: args, root: root})

        socket
        |> update(:servers, &Map.put(&1, key, %{id: id, pid: pid, name: name}))
        |> put_lsp(key, "#{name} running")
        |> push_event("lsp:ready", %{
          language: language,
          root: root,
          server: id,
          root_uri: Files.uri(root)
        })

      :install ->
        socket
        |> put_lsp(key, "installing Expert…")
        |> start_async({:install, language, root}, fn -> Servers.install_expert() end)

      {:error, message} ->
        put_lsp(socket, key, message)
    end
  end

  defp notify(socket, path, method, params) do
    for {{_language, root}, %{pid: pid}} <- socket.assigns.servers,
        String.starts_with?(path, root <> "/"),
        do: LanguageServer.send_message(pid, rpc(method, params))
  end

  defp rpc(method, params), do: Jason.encode!(%{jsonrpc: "2.0", method: method, params: params})

  defp put_lsp(socket, nil, _text), do: socket

  defp put_lsp(socket, {language, _root}, text),
    do: update(socket, :lsp, &Map.put(&1, language, text))

  ## Rendering

  @impl true
  def render(assigns) do
    assigns = assign(assigns, :active, assigns.tabs.active)

    ~H"""
    <div class="flex h-full min-h-0 flex-col">
      <header class="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <.icon name="ph-folder" class="text-muted" />
        <span class="min-w-0 flex-1 truncate text-sm font-medium" title={@root}>{Path.basename(@root)}</span>
        <.icon_button icon="ph-arrow-clockwise" label="Refresh files" phx-click="refresh" />
      </header>
      <div class="flex min-h-0 flex-1">
        <nav aria-label="Files" class="w-52 shrink-0 overflow-auto border-r border-line py-1 text-sm">
          <.tree
            entries={@entries[@root] || []}
            all={@entries}
            expanded={@expanded}
            active={@active}
            depth={0}
          />
        </nav>
        <section class="flex min-w-0 flex-1 flex-col">
          <div
            :if={@tabs.tabs != []}
            class="flex h-9 shrink-0 overflow-x-auto border-b border-line"
            role="tablist"
          >
            <div
              :for={tab <- @tabs.tabs}
              class={[
                "group flex shrink-0 items-center gap-1 border-r border-line pr-1 pl-3 text-xs",
                if(tab.path == @active, do: "bg-canvas text-ink", else: "text-muted hover:text-ink")
              ]}
            >
              <button
                type="button"
                role="tab"
                aria-selected={to_string(tab.path == @active)}
                title={tab.path}
                phx-click="activate"
                phx-value-path={tab.path}
              >
                {Path.basename(tab.path)}
              </button>
              <span :if={tab.dirty} class="size-1.5 rounded-full bg-ink" title="Unsaved"></span>
              <.icon_button
                icon="ph-x"
                label={"Close #{Path.basename(tab.path)}"}
                phx-click="close"
                phx-value-path={tab.path}
                data-confirm={tab.dirty && "Close #{Path.basename(tab.path)} without saving?"}
              />
            </div>
          </div>
          <.inline_notice :if={@notice} error>{@notice}</.inline_notice>
          <div class="relative min-h-0 flex-1">
            <div id="editor-host" phx-hook=".Editor" phx-update="ignore" class="absolute inset-0">
            </div>
            <div :if={@tabs.tabs == []} class="absolute inset-0">
              <.empty_state>Open a file from the tree.</.empty_state>
            </div>
          </div>
          <footer class="flex h-7 shrink-0 items-center gap-3 border-t border-line px-3 text-xs text-muted">
            <span :for={{language, text} <- @lsp}>{language}: {text}</span>
            <span class="flex-1"></span>
            <span :if={@active}>⌘S saves</span>
          </footer>
        </section>
      </div>
    </div>

    <script :type={Phoenix.LiveView.ColocatedHook} name=".Editor">
      import {EditorView, basicSetup} from "codemirror"
      import {Compartment, EditorState} from "@codemirror/state"
      import {keymap} from "@codemirror/view"
      import {indentWithTab} from "@codemirror/commands"
      import {HighlightStyle, syntaxHighlighting} from "@codemirror/language"
      import {tags} from "@lezer/highlight"
      import {LSPClient, languageServerExtensions, languageServerSupport} from "@codemirror/lsp-client"
      import {css} from "@codemirror/lang-css"
      import {html} from "@codemirror/lang-html"
      import {javascript} from "@codemirror/lang-javascript"
      import {json} from "@codemirror/lang-json"
      import {markdown} from "@codemirror/lang-markdown"
      import {python} from "@codemirror/lang-python"
      import {rust} from "@codemirror/lang-rust"
      import {yaml} from "@codemirror/lang-yaml"
      import {elixir} from "codemirror-lang-elixir"

      const languages = {
        elixir: () => elixir(), javascript: () => javascript({jsx: true}),
        typescript: () => javascript({typescript: true, jsx: true}), html: () => html(),
        css: () => css(), json: () => json(), markdown: () => markdown(), rust: () => rust(),
        python: () => python(), yaml: () => yaml(),
      }
      const servers = new Set(["elixir", "javascript", "typescript", "rust", "python"])

      // Colors come from Fathom's theme, so the editor follows light and dark.
      const theme = EditorView.theme({
        "&": {height: "100%", backgroundColor: "var(--color-canvas)", color: "var(--color-ink)", fontSize: "12.5px"},
        ".cm-scroller": {fontFamily: "var(--font-mono)", fontVariantLigatures: "none", lineHeight: "1.55"},
        ".cm-gutters": {backgroundColor: "var(--color-surface)", color: "var(--color-muted)", borderRight: "1px solid var(--color-line)"},
        ".cm-activeLine, .cm-activeLineGutter": {backgroundColor: "color-mix(in srgb, var(--color-ink) 5%, transparent)"},
        ".cm-cursor": {borderLeftColor: "var(--color-ink)"},
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {backgroundColor: "color-mix(in srgb, var(--color-info) 28%, transparent) !important"},
        ".cm-tooltip": {backgroundColor: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-line)", borderRadius: "6px"},
        ".cm-panels": {backgroundColor: "var(--color-surface)", color: "var(--color-ink)"},
      })
      const highlight = HighlightStyle.define([
        {tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: "var(--color-info)"},
        {tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--color-success)"},
        {tag: [tags.number, tags.bool, tags.atom, tags.null, tags.constant(tags.name)], color: "var(--color-warning)"},
        {tag: [tags.comment, tags.docComment], color: "var(--color-muted)", fontStyle: "italic"},
        {tag: [tags.typeName, tags.className, tags.namespace], color: "var(--color-warning)"},
        {tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--color-ink)", fontWeight: "600"},
        {tag: [tags.tagName, tags.attributeName], color: "var(--color-info)"},
        {tag: tags.invalid, color: "var(--color-danger)"},
      ])

      export default {
        mounted() {
          this.files = new Map()    // path -> {view, saved, lsp: Compartment, timer}
          this.clients = new Map()  // server id -> {client, handlers}
          this.ready = new Map()    // language + root -> server id
          this.waiting = new Map()  // language -> [path]
          this.handleEvent("editor:open", (file) => this.open(file))
          this.handleEvent("editor:show", ({path, line}) => this.show(path, line))
          this.handleEvent("editor:close", ({path}) => this.close(path))
          this.handleEvent("editor:disk", (file) => this.disk(file))
          this.handleEvent("editor:saved", ({path, content}) => this.saved(path, content))
          this.handleEvent("lsp:ready", (ready) => this.connect(ready))
          this.handleEvent("lsp:message", ({server, message}) => {
            for (const handler of this.clients.get(server)?.handlers ?? []) handler(message)
          })
          this.handleEvent("lsp:exit", ({server}) => {
            this.clients.get(server)?.client.disconnect()
            this.clients.delete(server)
          })
        },
        destroyed() {
          for (const {view} of this.files.values()) view.destroy()
          for (const {client} of this.clients.values()) client.disconnect()
        },
        open({path, uri, language, content, disk, line}) {
          if (this.files.has(path)) return this.show(path, line)
          const parent = document.createElement("div")
          parent.className = "absolute inset-0 hidden"
          this.el.appendChild(parent)
          const file = {saved: disk, lsp: new Compartment(), uri, language, parent, timer: null}
          const save = () => { this.pushEvent("save", {path, content: file.view.state.doc.toString()}); return true }
          file.view = new EditorView({
            parent,
            state: EditorState.create({
              doc: content,
              extensions: [
                basicSetup, theme, syntaxHighlighting(highlight),
                keymap.of([{key: "Mod-s", run: save, preventDefault: true}, indentWithTab]),
                languages[language]?.() ?? [],
                file.lsp.of([]),
                EditorView.updateListener.of((update) => update.docChanged && this.changed(path, file)),
              ],
            }),
          })
          this.files.set(path, file)
          if (content !== disk) this.changed(path, file)
          if (servers.has(language)) this.pushEvent("lsp_start", {language, path})
          this.show(path, line)
        },
        show(path, line) {
          for (const [p, file] of this.files) file.parent.classList.toggle("hidden", p !== path)
          const file = this.files.get(path)
          if (!file) return
          if (line) {
            const pos = file.view.state.doc.line(Math.min(line, file.view.state.doc.lines)).from
            file.view.dispatch({selection: {anchor: pos}, effects: EditorView.scrollIntoView(pos, {y: "center"})})
          }
          requestAnimationFrame(() => file.view.focus())
        },
        close(path) {
          const file = this.files.get(path)
          if (!file) return
          file.view.destroy()
          file.parent.remove()
          this.files.delete(path)
        },
        dirty(file) { return file.view.state.doc.toString() !== file.saved },
        // Unsaved text goes to Fathom after a pause, so it survives the dock closing.
        changed(path, file) {
          clearTimeout(file.timer)
          file.timer = setTimeout(() => {
            if (!this.files.has(path)) return
            if (this.dirty(file)) this.pushEvent("buffer", {path, content: file.view.state.doc.toString()})
            else this.pushEvent("clean", {path})
          }, 500)
        },
        saved(path, content) {
          const file = this.files.get(path)
          if (file) file.saved = content
        },
        // The file changed on disk: take it when there is nothing unsaved.
        disk({path, content, force}) {
          const file = this.files.get(path)
          if (!file || content === file.view.state.doc.toString()) { if (file) file.saved = content; return }
          if (this.dirty(file) && !force) {
            if (!confirm(`${path.split("/").pop()} changed on disk. Discard your unsaved changes and reload it?`)) return
          }
          file.saved = content
          file.view.dispatch({changes: {from: 0, to: file.view.state.doc.length, insert: content}})
        },
        connect({language, root, server, root_uri}) {
          if (!this.clients.has(server)) {
            const handlers = []
            const transport = {
              send: (message) => this.pushEvent("lsp_send", {server, message}),
              subscribe: (handler) => handlers.push(handler),
              unsubscribe: (handler) => handlers.splice(handlers.indexOf(handler) >>> 0, 1),
            }
            const client = new LSPClient({rootUri: root_uri, timeout: 15000, extensions: languageServerExtensions()})
            client.connect(transport)
            this.clients.set(server, {client, handlers})
          }
          const {client} = this.clients.get(server)
          for (const [path, file] of this.files) {
            if (file.language !== language || !path.startsWith(root + "/") || file.server) continue
            file.server = server
            file.view.dispatch({effects: file.lsp.reconfigure(languageServerSupport(client, file.uri, language))})
          }
        },
      }
    </script>
    """
  end

  attr :entries, :list, required: true
  attr :all, :map, required: true
  attr :expanded, :any, required: true
  attr :active, :string, default: nil
  attr :depth, :integer, required: true

  defp tree(assigns) do
    ~H"""
    <ul>
      <li :for={entry <- @entries}>
        <button
          type="button"
          phx-click={if entry.dir, do: "toggle", else: "open"}
          phx-value-path={entry.path}
          title={entry.path}
          style={"padding-left: #{8 + @depth * 12}px"}
          class={[
            "flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left",
            if(entry.path == @active,
              do: "bg-canvas text-ink",
              else: "text-muted hover:bg-canvas hover:text-ink"
            )
          ]}
        >
          <.icon
            name={
              cond do
                not entry.dir -> "ph-file"
                MapSet.member?(@expanded, entry.path) -> "ph-caret-down"
                true -> "ph-caret-right"
              end
            }
            class="shrink-0 text-xs"
          />
          <span class="truncate">{entry.name}</span>
        </button>
        <.tree
          :if={entry.dir and MapSet.member?(@expanded, entry.path)}
          entries={@all[entry.path] || []}
          all={@all}
          expanded={@expanded}
          active={@active}
          depth={@depth + 1}
        />
      </li>
    </ul>
    """
  end
end
