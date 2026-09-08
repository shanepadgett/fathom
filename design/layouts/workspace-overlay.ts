import { nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";

class WorkspaceOverlay extends DesignElement {
  override render() {
    return nothing;
  }
}

customElements.define("workspace-overlay", WorkspaceOverlay);
