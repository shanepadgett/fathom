import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { button } from "../../primitives/button.ts";
import { icon } from "../../primitives/icon.ts";
import { selectorButton } from "../../primitives/selector-button.ts";

export class ComposerElement extends DesignElement {
  static override properties = {
    model: { type: String },
    reasoning: { type: String },
  };

  declare model: string;
  declare reasoning: string;

  constructor() {
    super();
    this.model = "";
    this.reasoning = "";
  }

  override render() {
    const { model, reasoning } = this;
    return html`
      <div data-component="composer" class="rounded-lg border border-line bg-surface p-4">
        <p class="min-h-12 text-muted">Ask a follow-up or steer the current run…</p>
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          ${button({
            label: "Attach context",
            content: html`${icon("plus")}Attach context`,
            variant: "quiet",
          })}<span class="ml-auto flex flex-wrap items-center gap-3"
            >${selectorButton(model, reasoning)}${button({
              label: "Stop",
              content: html`Stop ${icon("stop", "small")}`,
            })}</span
          >
        </div>
      </div>
    `;
  }
}

customElements.define("message-composer", ComposerElement);
