import { html, nothing, type TemplateResult } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class InspectorSectionElement extends DesignElement {
  static override properties = {
    title: { type: String },
    content: { attribute: false },
    first: { type: Boolean },
  };

  declare title: string;
  declare content: TemplateResult | string;
  declare first: boolean;

  constructor() {
    super();
    this.title = "";
    this.first = false;
  }

  override render() {
    if (!this.content) {
      return nothing;
    }
    const { title, content, first } = this;
    return html`
      <section class="${first ? "" : "border-t border-line pt-4"}">
        <h3 class="mb-3 text-muted">${title}</h3>
        ${content}
      </section>
    `;
  }
}

customElements.define("inspector-section", InspectorSectionElement);
