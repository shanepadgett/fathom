import { html } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import "../primitives/edge-resizer.ts";

class WorkspaceDrawer extends DesignElement {
  private bounds = () => {
    const available = this.closest<HTMLElement>("workspace-layout")?.clientWidth ?? innerWidth;
    const max = Math.max(1, Math.min(1200, available - 80));
    return { min: Math.min(280, max), max };
  };

  override render() {
    return html`<edge-resizer edge="left" .bounds=${this.bounds}></edge-resizer>`;
  }
}

customElements.define("workspace-drawer", WorkspaceDrawer);
