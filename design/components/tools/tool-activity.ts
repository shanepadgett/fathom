import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";

export class ToolActivityElement extends DesignElement {
  static override properties = {
    label: { type: String },
    duration: { type: String },
    detail: { type: String },
    files: { attribute: false },
  };

  declare label: string;
  declare duration: string;
  declare detail: string;
  declare files: string[];

  constructor() {
    super();
    this.label = "";
    this.duration = "";
    this.files = [];
    this.detail = "";
  }

  override render() {
    const { label, duration, files } = this;
    return html`
      <details class="my-4 text-sm text-muted">
        <summary class="flex justify-between gap-4">
          <span class="flex items-center gap-1">${icon(
            "caret-right",
          )}${label}</span
          ><span class="text-muted">${duration}</span>
        </summary>
        <p class="mt-2 break-words text-muted ${this.detail
          ? ""
          : "font-mono"}">
          ${this.detail || files.join(" · ")}
        </p>
      </details>
    `;
  }
}

customElements.define("tool-activity", ToolActivityElement);
