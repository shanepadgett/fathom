import { html } from "lit";

import { createContextMeter } from "../components/context-meter.js";
import { HostElement, mountElement } from "../core/component.js";

class Shell extends HostElement {
  constructor() {
    super();
    this.mounted = new Map();
    this.context = createContextMeter();
    this.switching = false;
  }
  connectedCallback() {
    super.connectedCallback();
    this.unregistry = this.host.onRegistryChange(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this.unregistry?.();
    this.mounted.forEach((entry) => entry.dispose?.());
    this.mounted.clear();
    super.disconnectedCallback();
  }
  async switchProfile(event) {
    this.switching = true;
    this.host.state.patch({ error: "", liveText: "" });
    try {
      await this.host.transport.command("profile", {
        profile: event.target.value,
      });
      await this.host.transport.refresh();
    } catch (error) {
      this.host.state.patch({ error: error.message });
    } finally {
      this.switching = false;
      this.requestUpdate();
    }
  }
  updated() {
    const data = this.state.bootstrap;
    if (data) {
      this.context.update(data.session, this.state.liveText);
      this.querySelector("select").value = data.profiles?.length ? data.profile : "custom";
    }
    for (const [id, entry] of this.mounted) {
      if (!this.host.views.has(id)) {
        entry.dispose?.();
        entry.node.remove();
        this.mounted.delete(id);
      }
    }
    for (const [id, view] of this.host.views) {
      if (this.mounted.has(id)) continue;
      const node = document.createElement("section");
      node.className = "extension-view";
      node.setAttribute("aria-label", view.title);
      this.querySelector(view.slot === "rail" ? "aside" : "main").append(node);
      this.mounted.set(id, { node, dispose: view.mount(node, this.host) });
    }
  }
  render() {
    const { bootstrap: data, error, connected } = this.state;
    const profiles = data?.profiles || [];
    const status = !data
      ? "Connecting"
      : !connected
        ? "Reconnecting"
        : data.session.status === "running"
          ? "Working"
          : data.session.status === "idle"
            ? "Idle"
            : data.session.status;
    return html`
      <div class="context-bar">
        <div class="context-brand">
          <h1>FATHOM<span>.</span></h1>
        </div>
        <div>
          <span class="eyebrow">Workspace</span
          ><span class="workspace-path" title=${data?.workspace || ""}
            >${data?.workspace || "Loading workspace"}</span
          >
        </div>
        <div>
          <span class="eyebrow">Model</span
          ><span>${data ? `${data.model.provider} / ${data.model.id}` : "Connecting…"}</span>
        </div>
        <div>
          <label for="runtime" class="eyebrow">Runtime</label>
          <select
            id="runtime"
            aria-label="Runtime composition"
            aria-describedby="runtime-note"
            ?disabled=${this.switching || !profiles.length || data?.session.status === "running"}
            @change=${this.switchProfile}
          >
            ${
              profiles.length
                ? profiles.map(
                    (name) =>
                      html`<option value=${name}>
                        ${
                          name === "default"
                            ? "Default / pi-ai"
                            : name === "echo"
                              ? "Echo / alternate runtime"
                              : name
                        }
                      </option>`,
                  )
                : html`<option value="custom">${data?.runtime || "Connecting…"}</option>`
            }
          </select>
          <small id="runtime-note" class="runtime-note"
            >${profiles.length ? "Switching starts a fresh session" : "Custom composition"}</small
          >
        </div>
      </div>
      <div class="error-banner" role="alert" ?hidden=${!error}>${error}</div>
      <div class="workbench">
        <main class="main-view"></main>
        <aside class="side-rail" aria-label="Plugin composition"></aside>
      </div>
      <footer>
        <span
          class="footer-status status"
          role="status"
          data-state=${connected ? data?.session.status : "offline"}
          >${status}</span
        >${this.context.node}
      </footer>
    `;
  }
}
customElements.define("fathom-lit-shell", Shell);
export default {
  id: "ui.shell",
  activate: (host) => mountElement("fathom-lit-shell", document.querySelector("#app"), host),
};
