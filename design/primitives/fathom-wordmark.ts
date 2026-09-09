import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class FathomWordmarkElement extends DesignElement {
  override render() {
    return html`<span class="whitespace-nowrap font-bold tracking-tight"
      >Fathom<span class="text-action dark:text-teal-200">.</span></span
    >`;
  }
}

customElements.define("fathom-wordmark", FathomWordmarkElement);
