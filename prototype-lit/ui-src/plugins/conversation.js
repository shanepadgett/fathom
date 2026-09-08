import { html } from "lit";
import { guard } from "lit/directives/guard.js";
import { repeat } from "lit/directives/repeat.js";

import { HostElement, mountElement } from "../core/component.js";

class Conversation extends HostElement {
  connectedCallback() {
    super.connectedCallback();
    this.revision = 0;
    this.unregistry = this.host.onRegistryChange(() => {
      this.revision++;
      this.requestUpdate();
    });
  }
  disconnectedCallback() {
    this.unregistry?.();
    super.disconnectedCallback();
  }
  willUpdate() {
    const ledger = this.querySelector(".ledger");
    this.follow = !ledger || ledger.scrollHeight - ledger.scrollTop - ledger.clientHeight < 100;
  }
  firstUpdated() {
    this.resize();
  }
  updated() {
    const ledger = this.querySelector(".ledger");
    if (this.follow && ledger) ledger.scrollTop = ledger.scrollHeight;
  }
  resize() {
    const textarea = this.querySelector("textarea");
    textarea.style.height = "auto";
    const style = getComputedStyle(textarea);
    const line = parseFloat(style.lineHeight);
    const chrome =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const desired = Math.max(line * 2 + chrome, textarea.scrollHeight);
    textarea.style.height = `${Math.min(desired, line * 4 + chrome)}px`;
    textarea.style.overflowY = desired > line * 4 + chrome ? "auto" : "hidden";
  }
  async act(name) {
    this.host.state.patch({ error: "" });
    try {
      await this.host.transport.command(name);
      await this.host.transport.refresh();
    } catch (error) {
      this.host.state.patch({ error: error.message });
    }
  }
  async submit(event) {
    event.preventDefault();
    const textarea = this.querySelector("textarea");
    const text = textarea.value.trim();
    if (!text || this.submitting || this.state.bootstrap?.session.status === "running") return;
    this.submitting = true;
    this.host.state.patch({ error: "", liveText: "" });
    try {
      await this.host.transport.command("message", { text });
      textarea.value = "";
      this.resize();
      await this.host.transport.refresh();
    } catch (error) {
      this.host.state.patch({ error: error.message });
    } finally {
      this.submitting = false;
      this.requestUpdate();
    }
  }
  message(message) {
    const renderer = [...this.host.renderers.values()].find((entry) => entry.matches(message));
    if (renderer) return renderer.render(message, this.host);
    const content = html`<pre class="message-text">${message.text || ""}</pre>`;
    return message.role !== "tool"
      ? content
      : html`<details class="evidence ${message.isError ? "failed" : ""}">
          <summary>
            ${message.toolName || "Tool"} / ${message.isError ? "failed" : "result"}
          </summary>
          ${
            message.args
              ? html`<pre class="message-text">${JSON.stringify(message.args, null, 2)}</pre>`
              : ""
          }${content}
        </details>`;
  }
  render() {
    const { bootstrap, liveText, activeTool } = this.state;
    const messages = bootstrap?.session.messages || [];
    const busy = bootstrap?.session.status === "running";
    return html`
      <div class="section-heading">
        <h2>Working transcript</h2>
        <button ?disabled=${busy || !messages.length} @click=${() => this.act("reset")}>
          New session
        </button>
      </div>
      <div class="ledger" aria-label="Conversation">
        ${repeat(
          messages,
          (_message, index) => index,
          (message, index) =>
            html`<article class="ledger-row ${message.role}">
              <span class="row-number">${String(index + 1).padStart(2, "0")}</span>
              <div>
                <div class="role">
                  ${message.role === "user" ? "You / instruction" : message.role}
                </div>
                ${guard([JSON.stringify(message), this.revision], () => this.message(message))}
              </div>
            </article>`,
        )}
        ${
          !messages.length
            ? html`
                <section class="empty">
                  <h3>${"A workbench.\nYour way."}</h3>
                  <p>
                    Give the agent a task. Inspect its work. Swap the pieces that make it yours.
                  </p>
                  <div class="starters">
                    ${[
                      "Read the files in this workspace and explain its structure.",
                      "Create hello.txt with a short greeting, then read it back.",
                    ].map(
                      (prompt) =>
                        html`<button
                          @click=${() => {
                            const input = this.querySelector("textarea");
                            input.value = prompt;
                            this.resize();
                            input.focus();
                          }}
                        >
                          ${prompt} ↗
                        </button>`,
                    )}
                  </div>
                </section>
              `
            : ""
        }
        ${
          busy || liveText
            ? html`
                <article class="ledger-row live">
                  <span class="row-number">↳</span>
                  <div>
                    <div class="role">Agent / working</div>
                    <pre class="message-text">
${
                        liveText ||
                        (activeTool
                          ? `${activeTool.name}\n${JSON.stringify(activeTool.args, null, 2)}`
                          : "Thinking…")
                      }</pre>
                  </div>
                </article>
              `
            : ""
        }
      </div>
      <form class="composer" @submit=${this.submit}>
        <textarea
          id="prompt"
          aria-label="Your instruction"
          placeholder="Describe the work. Be specific."
          rows="2"
          required
          @input=${this.resize}
          @keydown=${(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              this.querySelector("form").requestSubmit();
            }
          }}
        ></textarea>
        <div class="composer-actions">
          <span class="hint">⌘ / Ctrl + Enter to run</span
          ><button type="button" ?disabled=${!busy} @click=${() => this.act("cancel")}>
            Stop ■</button
          ><button type="submit" class="primary" ?disabled=${busy || this.submitting}>
            Run agent ↗
          </button>
        </div>
      </form>
    `;
  }
}
customElements.define("fathom-lit-conversation", Conversation);
export default {
  id: "ui.conversation",
  activate: (host) =>
    host.registerView("conversation", {
      title: "Conversation",
      slot: "main",
      mount: (container, host) => mountElement("fathom-lit-conversation", container, host),
    }),
};
