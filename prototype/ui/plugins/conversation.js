import { button, el } from "../core/dom.js";

function defaultMessage(message) {
  const content = el("pre", { class: "message-text" }, message.text || "");
  if (message.role !== "tool") return content;
  return el(
    "details",
    { class: `evidence ${message.isError ? "failed" : ""}` },
    el(
      "summary",
      {},
      `${message.toolName || "Tool"} / ${
        message.isError ? "failed" : "result"
      }`,
    ),
    message.args
      ? el(
        "pre",
        { class: "message-text" },
        JSON.stringify(message.args, null, 2),
      )
      : "",
    content,
  );
}

function mount(container, host) {
  const ledger = el("div", { class: "ledger", "aria-label": "Conversation" });
  const textarea = el("textarea", {
    id: "prompt",
    "aria-label": "Your instruction",
    placeholder: "Describe the work. Be specific.",
    rows: "2",
    required: "",
  });
  function resizeTextarea() {
    textarea.style.height = "auto";
    const styles = getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const chrome = Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom) +
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);
    const minimum = lineHeight * 2 + chrome;
    const maximum = lineHeight * 4 + chrome;
    const desired = Math.max(minimum, textarea.scrollHeight);
    textarea.style.height = `${Math.min(desired, maximum)}px`;
    textarea.style.overflowY = desired > maximum ? "auto" : "hidden";
  }
  const submit = el(
    "button",
    { type: "submit", class: "primary" },
    "Run agent ↗",
  );
  const cancel = button("Stop ■", () => act("cancel"));
  const clear = button("New session", () => act("reset"));
  const form = el(
    "form",
    { class: "composer" },
    textarea,
    el(
      "div",
      { class: "composer-actions" },
      el("span", { class: "hint" }, "⌘ / Ctrl + Enter to run"),
      cancel,
      submit,
    ),
  );
  container.append(
    el(
      "div",
      { class: "section-heading" },
      el("h2", {}, "Working transcript"),
      clear,
    ),
    ledger,
    form,
  );
  async function act(name, payload) {
    host.state.patch({ error: "" });
    try {
      await host.transport.command(name, payload);
      await host.transport.refresh();
    } catch (error) {
      host.state.patch({ error: error.message });
    }
  }
  let submitting = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (
      !text || submitting ||
      host.state.get().bootstrap?.session.status === "running"
    ) return;
    submitting = true;
    submit.disabled = true;
    host.state.patch({ error: "", liveText: "" });
    try {
      await host.transport.command("message", { text });
      textarea.value = "";
      resizeTextarea();
      await host.transport.refresh();
    } catch (error) {
      host.state.patch({ error: error.message });
    } finally {
      submitting = false;
      submit.disabled =
        host.state.get().bootstrap?.session.status === "running";
    }
  });
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      form.requestSubmit();
    }
  });
  textarea.addEventListener("input", resizeTextarea);
  resizeTextarea();
  let lastMessages = "";
  let rows = [];
  const live = el(
    "article",
    { class: "ledger-row live" },
    el("span", { class: "row-number" }, "↳"),
    el(
      "div",
      {},
      el("div", { class: "role" }, "Agent / working"),
      el("pre", { class: "message-text" }),
    ),
  );
  const liveText = live.querySelector("pre");
  const unsubscribe = host.state.subscribe(
    ({ bootstrap, liveText: text, activeTool }) => {
      if (!bootstrap) return;
      const { session } = bootstrap;
      const busy = session.status === "running";
      submit.disabled = busy || submitting;
      cancel.disabled = !busy;
      clear.disabled = busy || !session.messages.length;
      const serialized = JSON.stringify(session.messages);
      const nearBottom =
        ledger.scrollHeight - ledger.scrollTop - ledger.clientHeight < 100;
      if (serialized !== lastMessages) {
        lastMessages = serialized;
        rows = session.messages.map((message, index) => {
          const renderer = [...host.renderers.values()].find((entry) =>
            entry.matches(message)
          );
          return el(
            "article",
            { class: `ledger-row ${message.role}` },
            el(
              "span",
              { class: "row-number" },
              String(index + 1).padStart(2, "0"),
            ),
            el(
              "div",
              {},
              el(
                "div",
                { class: "role" },
                message.role === "user" ? "You / instruction" : message.role,
              ),
              renderer
                ? renderer.render(message, host)
                : defaultMessage(message),
            ),
          );
        });
        ledger.replaceChildren(...rows);
        if (!rows.length) {
          ledger.append(
            el(
              "section",
              { class: "empty" },
              el("h3", {}, "A workbench.\nYour way."),
              el(
                "p",
                {},
                "Give the agent a task. Inspect its work. Swap the pieces that make it yours.",
              ),
              el(
                "div",
                { class: "starters" },
                ...[
                  "Read the files in this workspace and explain its structure.",
                  "Create hello.txt with a short greeting, then read it back.",
                ].map((prompt) =>
                  button(prompt + " ↗", () => {
                    textarea.value = prompt;
                    resizeTextarea();
                    textarea.focus();
                  })
                ),
              ),
            ),
          );
        }
      }
      live.remove();
      if (busy || text) {
        liveText.textContent = text ||
          (activeTool
            ? `${activeTool.name}\n${JSON.stringify(activeTool.args, null, 2)}`
            : "Thinking…");
        ledger.append(live);
      }
      if (nearBottom) ledger.scrollTop = ledger.scrollHeight;
    },
  );
  const unregistry = host.onRegistryChange(() => {
    lastMessages = "";
    host.state.patch({});
  });
  return () => {
    unsubscribe();
    unregistry();
    container.replaceChildren();
  };
}

export default {
  id: "ui.conversation",
  activate: (host) =>
    host.registerView("conversation", {
      title: "Conversation",
      slot: "main",
      mount,
    }),
};
