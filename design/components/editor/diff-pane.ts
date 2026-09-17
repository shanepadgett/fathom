import type { DiffLine } from "../../models/diff.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { drawerControl } from "../workspace/drawer-control.ts";
import { diffStat } from "./diff-stat.ts";
import "./diff-preview.ts";
import "./file-breadcrumbs.ts";

export class DiffPaneElement extends DesignElement {
  static override properties = {
    path: { attribute: false },
    lines: { attribute: false },
    count: { type: Number },
    added: { type: Number },
    removed: { type: Number },
    drawer: { type: Boolean },
  };

  declare path: string[];
  declare lines: DiffLine[];
  declare count: number;
  declare added: number;
  declare removed: number;
  declare drawer: boolean;

  constructor() {
    super();
    this.path = [];
    this.lines = [];
    this.count = 0;
    this.added = 0;
    this.removed = 0;
    this.drawer = false;
  }

  override render() {
    const { path, lines, count, added, removed, drawer } = this;
    return html`
      <section aria-label="File diff" class="min-h-0 flex-1 overflow-y-auto">
        <header
          class="flex ${
            drawer ? "h-12 pl-6" : "h-16 px-6"
          } items-center justify-between border-b border-line font-medium"
        >
          <span>Changed files <span class="ml-3 text-sm text-muted">${count}</span></span
          >${drawer ? drawerControl("diff", true) : ""}
        </header>
        <file-breadcrumbs .path=${path}></file-breadcrumbs>
        <div class="border-b border-line px-6 py-2">${diffStat(added, removed)}</div>
        <diff-preview .lines=${lines}></diff-preview>
        <p class="px-6 text-sm text-muted">Showing 1 of ${count} changed files</p>
      </section>
    `;
  }
}

customElements.define("diff-pane", DiffPaneElement);
