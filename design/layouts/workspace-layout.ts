import { nothing } from "lit";

import { DesignElement } from "../foundation/design-element.ts";

class WorkspaceLayout extends DesignElement {
  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this.toggleSidebar);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.toggleSidebar);
  }

  private toggleSidebar = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("[data-sidebar-toggle]");
    if (!button || button.closest("workspace-layout") !== this) return;
    const sidebar = this.querySelector<HTMLElement>(".workspace-body > workspace-sidebar");
    if (!sidebar) return;
    sidebar.hidden = !sidebar.hidden;
    button.setAttribute("aria-expanded", String(!sidebar.hidden));
    const label = sidebar.hidden ? "Open sidebar" : "Close sidebar";
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  override render() {
    return nothing;
  }
}

customElements.define("workspace-layout", WorkspaceLayout);
