import { nothing } from "lit";

import { DesignElement } from "./design-element.ts";

/** Authored native buttons own labels, events, disabled state, and form behavior. */
export class DesignButton extends DesignElement {
  override render() {
    return nothing;
  }
}

customElements.define("ds-button", DesignButton);
