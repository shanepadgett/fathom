import { nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";

/** Structural elements keep authored children in light DOM. CSS owns geometry. */
class WorkspaceShell extends DesignElement {
  override render() {
    return nothing;
  }
}

customElements.define("workspace-shell", WorkspaceShell);
