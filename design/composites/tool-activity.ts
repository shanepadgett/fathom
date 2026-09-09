import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

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
      <div class="my-6 border-y border-line py-3 text-sm">
        <p class="flex justify-between gap-4">
          <span class="flex items-center gap-1">${icon("check")}${label}</span
          ><span class="text-muted">${duration}</span>
        </p>
        <p class="mt-2 break-words text-muted ${this.detail ? "" : "font-mono"}">
          ${this.detail || files.join(" · ")}
        </p>
      </div>
    `;
  }
}

customElements.define("tool-activity", ToolActivityElement);
