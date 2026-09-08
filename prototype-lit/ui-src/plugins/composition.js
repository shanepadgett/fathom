import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { HostElement, mountElement } from "../core/component.js";

class Composition extends HostElement {
  disconnectedCallback() {
    this.workbench?.classList.remove("rail-collapsed");
    super.disconnectedCallback();
  }
  render() {
    const data = this.state.bootstrap;
    if (!data) return;
    return html`
      <details
        class="composition-panel"
        open
        @toggle=${(event) => {
          this.workbench = this.closest(".workbench");
          this.workbench?.classList.toggle("rail-collapsed", !event.target.open);
        }}
      >
        <summary class="section-heading">
          <h2>Composition (${data.plugins.length})</h2>
        </summary>
        <div class="composition-body">
          <p class="rail-intro">The harness is the sum of its parts. Every service has an owner.</p>
          ${repeat(
            data.plugins,
            (plugin) => plugin.id,
            (plugin) => html`
              <details class="plugin-entry">
                <summary>
                  <span>${plugin.id}</span><span class="plugin-status">${plugin.status}</span>
                </summary>
                <dl>
                  <dt>PROVIDES</dt>
                  <dd>${plugin.provides.join(", ") || "—"}</dd>
                  <dt>REQUIRES</dt>
                  <dd>${plugin.requires.join(", ") || "None"}</dd>
                </dl>
              </details>
            `,
          )}
          <h3 class="tool-heading eyebrow">Available tools</h3>
          ${repeat(
            data.tools,
            (tool) => tool.name,
            (tool) => html`
              <details class="tool-entry">
                <summary>${tool.name}</summary>
                <p>${tool.description}</p>
              </details>
            `,
          )}
          <div class="composition-note">
            BUILT TO BE REPLACED.
            <p>
              ${
                data.profiles?.includes("echo")
                  ? "Switch to Echo to try an alternate runtime. Switching starts a fresh session."
                  : "This workbench runs your custom composition. Its plugins are selected by configuration."
              }
            </p>
          </div>
        </div>
      </details>
    `;
  }
}
customElements.define("fathom-lit-composition", Composition);
export default {
  id: "ui.composition",
  activate: (host) =>
    host.registerView("composition", {
      title: "Composition",
      slot: "rail",
      mount: (container, host) => mountElement("fathom-lit-composition", container, host),
    }),
};
