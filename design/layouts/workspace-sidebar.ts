import { html } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import "../primitives/edge-resizer.ts";
import { sidebarBounds } from "./sidebar-sizing.ts";

class WorkspaceSidebar extends DesignElement {
  static override properties = { placement: { type: String, reflect: true } };

  declare placement: "chats" | "files" | "inspector";

  constructor() {
    super();
    this.placement = "chats";
  }

  override render() {
    return html`
      <edge-resizer
        .bounds=${() => sidebarBounds(this)}
        edge=${this.placement === "inspector" ? "left" : "right"}
      ></edge-resizer>
    `;
  }
}

customElements.define("workspace-sidebar", WorkspaceSidebar);
