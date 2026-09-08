import { html, nothing, type TemplateResult } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./keyboard-hint-bar.ts";

export class SearchSurfaceElement extends DesignElement {
  static override properties = {
    label: { type: String },
    heading: { type: String },
    field: { attribute: false },
    results: { attribute: false },
    action: { type: String },
  };

  declare label: string;
  declare heading: string;
  declare field: TemplateResult | string;
  declare results: TemplateResult | TemplateResult[] | string;
  declare action: string;

  constructor() {
    super();
    this.label = "";
    this.heading = "";
    this.action = "";
  }

  override render() {
    if (!this.field) {
      return nothing;
    }
    if (!this.results) {
      return nothing;
    }
    const { label, heading, field, results, action } = this;
    return html`
      <section
        data-component="search-surface"
        class="w-search-panel overflow-hidden rounded-lg border border-line bg-canvas shadow-md"
        aria-label="${label}"
      >
        ${field}
        <div class="px-2 pb-2">
          <h3 class="px-3 py-2 text-xs text-muted">${heading}</h3>
          ${results}
        </div>
        <keyboard-hint-bar .action=${action}></keyboard-hint-bar>
      </section>
    `;
  }
}

customElements.define("search-surface", SearchSurfaceElement);
