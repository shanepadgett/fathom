import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { meter } from "../primitives/meter.ts";
import "./run-status.ts";

export class WorkspaceStatusBarElement extends DesignElement {
  static override properties = {
    status: { type: String },
    changed: { type: Number },
    context: { attribute: false },
  };

  declare status: string;
  declare changed: number;
  declare context: {
    value: number;
    maximum: number;
  };

  constructor() {
    super();
    this.status = "";
    this.changed = 0;
  }

  override render() {
    if (!this.context) {
      return nothing;
    }
    const { status, changed, context } = this;
    return html`
      <footer
        data-component="workspace-status"
        class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm"
      >
        <div class="flex items-center gap-4">
          <run-status .label=${`Agent · ${status}`} .tone=${"success"}></run-status
          ><span class="text-muted">${changed} files changed</span>
        </div>
        <div class="flex items-center gap-4">
          ${meter(context.value, context.maximum, "Context usage")}<span
            >${context.value}k / ${context.maximum}k</span
          >
        </div>
      </footer>
    `;
  }
}

customElements.define("workspace-status-bar", WorkspaceStatusBarElement);
