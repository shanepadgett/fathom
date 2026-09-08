import { nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";

class WorkspaceBody extends DesignElement {
  override render() {
    return nothing;
  }
}

customElements.define("workspace-body", WorkspaceBody);
