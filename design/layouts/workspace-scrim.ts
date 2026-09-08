import { nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";

class WorkspaceScrim extends DesignElement {
  override render() {
    return nothing;
  }
}

customElements.define("workspace-scrim", WorkspaceScrim);
