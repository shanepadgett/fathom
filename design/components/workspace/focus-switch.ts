import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";

export type Focus = "agent" | "editor" | "chat";

const focusOptions = [
  { focus: "editor", label: "Editor" },
  { focus: "agent", label: "Agent" },
  { focus: "chat", label: "Chat" },
] as const;

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
        ${focusOptions.map(
          ({ focus, label }) => html`
            <button
              type="button"
              aria-label="${label} focus"
              aria-pressed="${mode === focus}"
              class="flex h-8 px-3 text-dense items-center justify-center border-r border-line last:border-r-0 ${
                mode === focus ? "bg-canvas text-action" : "text-muted hover:text-ink"
              }"
            >
              ${label}
            </button>
          `,
        )}
      </div>
    `;
  }
}

customElements.define("focus-switch", FocusSwitchElement);
