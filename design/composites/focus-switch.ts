import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

export type Focus = "agent" | "editor";

export class FocusSwitchElement extends DesignElement {
  static override properties = { mode: { type: String } };
  declare mode: Focus;

  constructor() {
    super();
    this.mode = "agent";
  }

  override render() {
    const { mode } = this;
    return html`
      <div
        role="group"
        aria-label="Workspace focus"
        class="flex overflow-hidden rounded-control border border-line"
      >
        ${(["agent", "editor"] as const).map(
          (focus) => html`
            <button
              type="button"
              aria-label="${focus === "agent" ? "Agent" : "Editor"} focus"
              aria-pressed="${mode === focus}"
              class="flex h-8 w-10 items-center justify-center first:border-r first:border-line ${
                mode === focus ? "bg-canvas text-action" : "text-muted hover:text-ink"
              }"
            >
              ${icon(focus === "agent" ? "chat-circle-text" : "code", "toolbar")}
            </button>
          `,
        )}
      </div>
    `;
  }
}

customElements.define("focus-switch", FocusSwitchElement);
