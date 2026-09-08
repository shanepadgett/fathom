import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class BreadcrumbsElement extends DesignElement {
  static override properties = { path: { attribute: false } };
  declare path: string[];

  constructor() {
    super();
    this.path = [];
  }

  override render() {
    const { path } = this;
    return html`
      <p
        data-component="breadcrumbs"
        class="flex h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-line px-4 text-sm text-muted"
      >
        ${path.map(
          (part, index) => html`
            ${index ? html`<span aria-hidden="true">/</span>` : ""}<span
              class="truncate ${index === path.length - 1 ? "text-ink" : ""}"
              >${part}</span
            >
          `,
        )}
      </p>
    `;
  }
}

customElements.define("file-breadcrumbs", BreadcrumbsElement);
