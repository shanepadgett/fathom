const state = {
  snapshot: null,
  messages: [],
  tools: new Map(),
  notices: [],
  rendererState: { draft: "", extensionsOpen: true },
  toolRenderers: new Map(),
  messageRenderers: [],
  composerFactory: null,
  composer: null,
};

class FathomApp extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <aside class="rail">
        <header class="brand"><span class="brand-mark">F</span><span>Fathom</span></header>
        <button class="rail-action" data-action="new-session">+ New session</button>
        <nav class="sessions" aria-label="Sessions"></nav>
        <button class="rail-action extensions-toggle" data-action="extensions">Extensions</button>
      </aside>
      <main class="workspace-shell">
        <header class="statusbar">
          <div><strong class="session-title">Loading</strong><span class="workspace-path"></span></div>
          <div class="status-actions"><span class="model"></span><span class="run-state"></span><button class="reload" hidden>Reload extensions</button></div>
        </header>
        <section class="transcript" aria-live="polite"></section>
        <section class="approval" hidden></section>
        <section class="notices"></section>
        <section class="composer-host"></section>
      </main>
      <aside class="extension-panel"><header><h2>Extensions</h2><button data-action="close-extensions" aria-label="Close extensions">×</button></header><p class="panel-note">Changes apply together on reload.</p><div class="extension-list"></div></aside>
    `;
    this.addEventListener("click", (event) => this.onClick(event));
    this.addEventListener("change", (event) => this.onChange(event));
  }

  async onClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    try {
      if (action === "new-session") await bindings.command({ type: "create_session" });
      else if (action === "select-session") {
        await bindings.command({ type: "select_session", sessionId: button.dataset.id });
      } else if (action === "extensions") {
        state.rendererState.extensionsOpen = !state.rendererState.extensionsOpen;
        render();
      } else if (action === "close-extensions") {
        state.rendererState.extensionsOpen = false;
        render();
      } else if (action === "reload") await reloadExtensions();
      else if (action === "abort") await bindings.command({ type: "abort" });
      else if (action === "approve" || action === "reject") {
        await bindings.command({
          type: "resolve_approval",
          approvalId: state.snapshot.approval.id,
          approved: action === "approve",
        });
      }
    } catch (error) {
      notice(error.message ?? String(error), "error");
    }
  }

  async onChange(event) {
    const input = event.target.closest("input[data-extension]");
    if (!input) return;
    try {
      await bindings.command({
        type: "toggle_extension",
        extensionId: input.dataset.extension,
        enabled: input.checked,
      });
    } catch (error) {
      input.checked = !input.checked;
      notice(error.message ?? String(error), "error");
    }
  }
}
customElements.define("fathom-app", FathomApp);

class FathomComposer extends HTMLElement {
  connectedCallback() {
    if (this.innerHTML) return;
    this.innerHTML = `
      <div class="slash-help" hidden></div>
      <textarea aria-label="Message Fathom" placeholder="Ask Fathom, or type / for commands" rows="3"></textarea>
      <footer><span class="composer-hint">⌘↵ send · /reload extensions</span><button class="abort-button" data-action="abort" hidden>Stop</button><button class="send-button">Send</button></footer>
    `;
    this.textarea = this.querySelector("textarea");
    this.textarea.value = state.rendererState.draft;
    this.querySelector(".send-button").onclick = () => submit(this.textarea.value);
    this.textarea.addEventListener("input", () => {
      state.rendererState.draft = this.textarea.value;
      this.renderCommands();
    });
    this.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        submit(this.textarea.value);
      }
    });
    this.renderCommands();
  }
  getValue() {
    return this.textarea?.value ?? "";
  }
  setValue(value) {
    if (this.textarea) this.textarea.value = value;
  }
  focusInput() {
    this.textarea?.focus();
  }
  renderCommands() {
    const help = this.querySelector(".slash-help");
    const value = this.textarea.value.trim();
    if (!value.startsWith("/") || value.includes(" ")) {
      help.hidden = true;
      return;
    }
    const query = value.slice(1).toLowerCase();
    const commands = (state.snapshot?.commands ?? []).filter((item) => item.name.includes(query));
    help.replaceChildren(
      ...commands.map((command) =>
        node("div", "slash-row", `/${command.name}  ${command.description}`)
      ),
    );
    help.hidden = commands.length === 0;
  }
}
customElements.define("fathom-composer", FathomComposer);

globalThis.fathomReceive = (event) => {
  if (event.type === "snapshot") applySnapshot(event.snapshot);
  else if (["message_started", "message_updated", "message_finished"].includes(event.type)) {
    upsertMessage(event.record);
  } else if (event.type.startsWith("tool_")) {
    state.tools.set(event.toolCallId, event);
    render();
  } else if (event.type === "approval_required") {
    state.snapshot.approval = event.approval;
    render();
  } else if (event.type === "approval_resolved") {
    state.snapshot.approval = undefined;
    render();
  } else if (event.type === "notice") notice(event.message, event.level);
};

async function bootstrap() {
  try {
    const payload = await bindings.bootstrap();
    state.rendererState = payload.rendererState;
    applySnapshot(payload.snapshot, false);
    await loadRendererExtensions();
    render();
  } catch (error) {
    notice(error.message ?? String(error), "error");
  }
}

function applySnapshot(snapshot, rerender = true) {
  if (state.snapshot && snapshot.generation < state.snapshot.generation) return;
  state.snapshot = snapshot;
  state.messages = snapshot.messages.slice();
  if (rerender) render();
}

function upsertMessage(record) {
  const index = state.messages.findIndex((item) => item.id === record.id);
  if (index >= 0) state.messages[index] = record;
  else state.messages.push(record);
  render();
}

async function loadRendererExtensions() {
  state.toolRenderers.clear();
  state.messageRenderers = [];
  state.composerFactory = null;
  for (
    const extension of state.snapshot.extensions.filter((item) => item.active && item.rendererEntry)
  ) {
    try {
      const module = await import(extension.rendererEntry);
      if (typeof module.activate !== "function") {
        throw new Error("Renderer entry must export activate()");
      }
      await module.activate({
        registerToolRenderer(name, renderer) {
          state.toolRenderers.set(name, renderer);
        },
        registerMessageRenderer(renderer) {
          state.messageRenderers.push(renderer);
        },
        replaceComposer(factory) {
          state.composerFactory = factory;
        },
        createElement: node,
      });
    } catch (error) {
      notice(`${extension.name}: ${error.message ?? error}`, "error");
    }
  }
}

async function submit(raw) {
  const text = raw.trim();
  if (!text || state.snapshot.busy) return;
  try {
    if (text === "/reload") await reloadExtensions(false);
    else if (text.startsWith("/")) {
      const [name, ...args] = text.slice(1).split(/\s+/);
      await bindings.command({ type: "run_command", name, arguments: args.join(" ") });
    } else await bindings.command({ type: "prompt", text });
    state.rendererState.draft = "";
    state.composer?.setValue?.("");
  } catch (error) {
    notice(error.message ?? String(error), "error");
  }
}

async function reloadExtensions(preserveDraft = true) {
  if (state.snapshot.busy) throw new Error("Stop the active run before reloading extensions");
  state.rendererState.draft = preserveDraft
    ? state.composer?.getValue?.() ?? state.rendererState.draft
    : "";
  await bindings.reloadExtensions(state.rendererState);
}

function render() {
  const app = document.querySelector("fathom-app");
  if (!app || !state.snapshot) return;
  app.querySelector(".workspace-path").textContent = state.snapshot.workspace;
  app.querySelector(".model").textContent = state.snapshot.model;
  app.querySelector(".run-state").textContent = state.snapshot.busy ? "running" : "ready";
  const session = state.snapshot.sessions.find((item) =>
    item.id === state.snapshot.selectedSessionId
  );
  app.querySelector(".session-title").textContent = session?.title ?? "Session";

  const sessions = app.querySelector(".sessions");
  sessions.replaceChildren(...state.snapshot.sessions.map((item) => {
    const button = node(
      "button",
      item.id === state.snapshot.selectedSessionId ? "session active" : "session",
      item.title,
    );
    button.dataset.action = "select-session";
    button.dataset.id = item.id;
    return button;
  }));

  app.querySelector(".extension-panel").classList.toggle(
    "open",
    state.rendererState.extensionsOpen,
  );
  const extensions = app.querySelector(".extension-list");
  extensions.replaceChildren(...state.snapshot.extensions.map(extensionRow));
  const reload = app.querySelector(".reload");
  reload.hidden = !state.snapshot.pendingReload;
  reload.disabled = state.snapshot.busy;
  reload.dataset.action = "reload";

  renderApproval(app);
  renderComposer(app);
  const transcript = app.querySelector(".transcript");
  transcript.replaceChildren(...state.messages.map(renderMessage));
  transcript.scrollTop = transcript.scrollHeight;
  renderNotices(app);
}

function renderMessage(record) {
  const message = record.message;
  for (const renderer of state.messageRenderers) {
    const rendered = renderer(message, record);
    if (rendered) return rendered;
  }
  const article = node("article", `message ${message.role} ${record.status}`);
  article.append(
    node("div", "message-label", message.role === "assistant" ? "Fathom" : message.role),
  );
  if (message.role === "user") {
    article.append(node("div", "message-text", textContent(message.content)));
  } else if (message.role === "assistant") {
    for (const block of message.content ?? []) {
      if (block.type === "text") article.append(node("div", "message-text", block.text));
      else if (block.type === "thinking") {
        article.append(node("details", "thinking", "Reasoning retained"));
      } else if (block.type === "toolCall") article.append(renderTool("call", block.name, block));
    }
  } else if (message.role === "toolResult") {
    article.append(renderTool("result", message.toolName, message));
  }
  return article;
}

function renderTool(phase, name, payload) {
  const custom = state.toolRenderers.get(name)?.[phase];
  if (custom) {
    const result = custom(payload);
    if (result) return result;
  }
  const block = node("section", `tool-block ${phase}`);
  block.append(node("div", "tool-heading", `${phase === "call" ? "Run" : "Result"} · ${name}`));
  const body = phase === "call"
    ? JSON.stringify(payload.arguments, null, 2)
    : textContent(payload.content);
  block.append(node("pre", "tool-body", body));
  return block;
}

function renderComposer(app) {
  const host = app.querySelector(".composer-host");
  const desired = state.composerFactory ? "extension" : "default";
  if (host.dataset.kind !== desired) {
    const controller = { submit, abort: () => bindings.command({ type: "abort" }) };
    state.composer = state.composerFactory
      ? state.composerFactory(controller)
      : document.createElement("fathom-composer");
    host.replaceChildren(state.composer);
    host.dataset.kind = desired;
    state.composer.setValue?.(state.rendererState.draft);
  }
  const textarea = state.composer.querySelector?.("textarea");
  if (textarea) textarea.disabled = false;
  const send = state.composer.querySelector?.(".send-button");
  if (send) send.disabled = state.snapshot.busy;
  const abort = state.composer.querySelector?.(".abort-button");
  if (abort) abort.hidden = !state.snapshot.busy;
}

function renderApproval(app) {
  const host = app.querySelector(".approval");
  const approval = state.snapshot.approval;
  host.hidden = !approval;
  if (!approval) {
    host.replaceChildren();
    return;
  }
  host.replaceChildren(
    node("div", "approval-copy", `${approval.title}  ${approval.detail}`),
    actionButton("Reject", "reject", "secondary"),
    actionButton("Approve overwrite", "approve", "primary"),
  );
}

function renderNotices(app) {
  app.querySelector(".notices").replaceChildren(
    ...state.notices.slice(-3).map((item) => node("div", `notice ${item.level}`, item.message)),
  );
}

function extensionRow(extension) {
  const row = node("label", "extension-row");
  const copy = node("span", "extension-copy");
  copy.append(
    node("strong", "", extension.name),
    node("small", "", extension.error ?? extension.description ?? extension.id),
  );
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = extension.enabled;
  toggle.dataset.extension = extension.id;
  row.append(copy, toggle);
  return row;
}

function notice(message, level = "info") {
  state.notices.push({ message, level });
  render();
}

function actionButton(label, action, className) {
  const button = node("button", className, label);
  button.dataset.action = action;
  return button;
}

function textContent(content) {
  if (typeof content === "string") return content;
  return (content ?? []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
}

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

await bootstrap();
