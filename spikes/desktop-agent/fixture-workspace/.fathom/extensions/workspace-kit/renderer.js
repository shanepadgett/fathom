class FocusComposer extends HTMLElement {
  connectedCallback() {
    if (this.innerHTML) return;
    this.innerHTML = `
      <div class="extension-composer-label">WORKSPACE KIT · FOCUSED COMPOSER</div>
      <textarea aria-label="Message Fathom" placeholder="Describe the file task or type /workspace-stats" rows="3"></textarea>
      <footer><span class="composer-hint">Extension-provided input · ⌘↵ send</span><button class="abort-button" data-action="abort" hidden>Stop</button><button class="send-button">Send</button></footer>
    `;
    this.textarea = this.querySelector("textarea");
    this.textarea.value = this.initialValue ?? "";
    this.textarea.addEventListener("input", () => this.initialValue = this.textarea.value);
    this.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.controller.submit(this.textarea.value);
      }
    });
    this.querySelector(".send-button").onclick = () => this.controller.submit(this.textarea.value);
  }
  getValue() {
    return this.textarea?.value ?? this.initialValue ?? "";
  }
  setValue(value) {
    this.initialValue = value;
    if (this.textarea) this.textarea.value = value;
  }
  focusInput() {
    this.textarea?.focus();
  }
}
customElements.define("focus-composer", FocusComposer);

export function activate(api) {
  api.registerToolRenderer("workspace_stats", {
    call(payload) {
      const block = api.createElement("section", "tool-block workspace-stats");
      block.append(
        api.createElement("div", "tool-heading", "Workspace kit · scan"),
        api.createElement("div", "workspace-stat-copy", "Counting top-level workspace files"),
      );
      return block;
    },
    result(payload) {
      const details = payload.details ?? {};
      const block = api.createElement("section", "tool-block workspace-stats");
      block.append(
        api.createElement("div", "tool-heading", details.label ?? "Workspace inventory"),
        api.createElement("div", "workspace-stat-number", String(details.files ?? "–")),
        api.createElement("div", "workspace-stat-copy", `${details.bytes ?? "–"} bytes`),
      );
      return block;
    },
  });
  api.replaceComposer((controller) => {
    const composer = document.createElement("focus-composer");
    composer.controller = controller;
    return composer;
  });
}
