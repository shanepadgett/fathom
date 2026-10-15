import type { ContextUsage } from "../../models/context-usage.ts";
import type { SystemStatus } from "../../models/system-status.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import "./context-usage.ts";
import "../tools/run-status.ts";

export class WorkspaceStatusBarElement extends DesignElement {
  static override properties = {
    system: { attribute: false },
    context: { attribute: false },
    contextOpen: { type: Boolean },
  };

  declare system: SystemStatus;
  declare context: ContextUsage | undefined;
  declare contextOpen: boolean;

  constructor() {
    super();
    this.system = { runningAgents: 0 };
    this.contextOpen = false;
  }

  override render() {
    // A new tab has no session, so it shows agent activity without context.
    if (!this.system) {
      return nothing;
    }
    const { system, context } = this;
    return html`
      <footer
        data-component="workspace-status"
        class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm"
      >
        <run-status
          .label=${system.runningAgents
            ? `${system.runningAgents} ${
              system.runningAgents === 1 ? "agent" : "agents"
            } running`
            : "All quiet"}
          .tone=${system.runningAgents ? "success" : "neutral"}
        ></run-status>
        ${context
          ? html`<context-usage .data=${context} .open=${this.contextOpen}></context-usage>`
          : nothing}
      </footer>
    `;
  }
}

customElements.define("workspace-status-bar", WorkspaceStatusBarElement);
