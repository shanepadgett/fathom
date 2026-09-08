import type { Changes } from "../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { diffStat } from "../primitives/diff-stat.ts";

export class ChangeSummaryElement extends DesignElement {
  static override properties = {
    changes: { attribute: false },
    description: { type: String },
  };

  declare changes: Changes;
  declare description: string;

  constructor() {
    super();
    this.description = "";
  }

  override render() {
    if (!this.changes) {
      return nothing;
    }
    const { changes, description } = this;
    return html`
      <div class="mt-4 border-l-2 border-action pl-4">
        <p class="flex items-center gap-3 font-medium">
          ${changes.count} files changed ${diffStat(changes.added, changes.removed)}
        </p>
        ${description ? html`<p class="mt-2 text-sm text-muted">${description}</p>` : ""}
      </div>
    `;
  }
}

customElements.define("change-summary", ChangeSummaryElement);
