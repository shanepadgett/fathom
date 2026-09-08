import type { SystemStatus } from "../models/system-status.ts";
import type { ContextUsage } from "../models/context-usage.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./context-usage.ts";
import "./run-status.ts";

export class WorkspaceStatusBarElement extends DesignElement {
  static override properties = {
    system: { attribute: false },
    context: { attribute: false },
    contextOpen: { type: Boolean },
  };

  declare system: SystemStatus;
  declare context: ContextUsage;
  declare contextOpen: boolean;

  constructor() {
    super();
    this.system = { runningAgents: 0 };
    this.contextOpen = false;
  }

  override render() {
    if (!this.context) {
      return nothing;
    }
    const { system, context } = this;
    return html`
      <footer
        data-component="workspace-status"
        class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm"
      >
        <run-status
          .label=${system.runningAgents ? `${system.runningAgents} ${system.runningAgents === 1 ? "agent" : "agents"} running` : "All quiet"}
          .tone=${system.runningAgents ? "success" : "neutral"}
        ></run-status>
        <context-usage .data=${context} .open=${this.contextOpen}></context-usage>
      </footer>
    `;
  }
}

customElements.define("workspace-status-bar", WorkspaceStatusBarElement);
