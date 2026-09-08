import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

export class ProjectIdentityElement extends DesignElement {
  static override properties = { name: { type: String } };
  declare name: string;

  constructor() {
    super();
    this.name = "";
  }

  override render() {
    const { name } = this;
    return html`
      <span class="flex min-w-0 items-center gap-1.5"
        >${icon("folder")}<span class="truncate">${name}</span></span
      >
    `;
  }
}

customElements.define("project-identity", ProjectIdentityElement);
