import type { Changes } from "../../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { button } from "../../primitives/button.ts";
import { icon } from "../../primitives/icon.ts";
import { diffStat } from "./diff-stat.ts";

export class ChangeSummaryElement extends DesignElement {
  static override properties = {
    changes: { attribute: false },
    expanded: { state: true },
  };

  declare changes: Changes;
  declare private expanded: boolean;

  constructor() {
    super();
    this.expanded = false;
  }

  override render() {
    if (!this.changes) return nothing;
    const files = this.changes.files;
    const count = files?.length ?? this.changes.count;
    const added = files?.reduce((sum, file) => sum + file.added, 0) ?? this.changes.added;
    const removed = files?.reduce((sum, file) => sum + file.removed, 0) ?? this.changes.removed;
    return html`<section class="rounded-lg border border-line bg-surface p-4" aria-label="Changes">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3"><h4 class="font-medium">${count} ${count === 1 ? "file" : "files"} changed</h4>${diffStat(added, removed)}</div>
        <div class="ml-auto flex items-center gap-2">
          ${button({ label: "Review", variant: "secondary", disabled: !count })}
          ${button({ label: "Undo", content: html`${icon("arrow-counter-clockwise")} Undo`, variant: "quiet", disabled: !count })}
        </div>
      </header>
      ${files?.length ? html`<ul class="mt-3 divide-y divide-line border-t border-line">
        ${(this.expanded ? files : files.slice(0, 3)).map((file) => html`<li class="flex items-baseline justify-between gap-3 py-2 text-sm">
          <span class="min-w-0 break-words font-mono">${file.path}</span>
          <span class="shrink-0">${diffStat(file.added, file.removed)}</span>
        </li>`)}
      </ul>` : nothing}
      ${files && files.length > 3 ? html`<ds-button variant="quiet" size="compact"><button class="mt-2" type="button" aria-expanded=${this.expanded} @click=${() => { this.expanded = !this.expanded; }}>${this.expanded ? "Show fewer files" : `Show all ${files.length} files`}</button></ds-button>` : nothing}

    </section>`;
  }
}

customElements.define("change-summary", ChangeSummaryElement);
