import type { FileNode } from "../../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { changeStatus } from "../editor/change-status.ts";
import { icon } from "../../primitives/icon.ts";

export class FileItemElement extends DesignElement {
  static override properties = {
    file: { attribute: false },
    selected: { type: Boolean },
    tree: { type: Boolean },
  };

  declare file: FileNode;
  declare selected: boolean;
  declare tree: boolean;

  constructor() {
    super();
    this.selected = false;
    this.tree = false;
  }

  override render() {
    if (!this.file) {
      return nothing;
    }
    const { file, selected, tree } = this;
    return html`
      <div
        data-file-row
        class="flex h-6 min-w-0 items-center gap-1.5 rounded-sm pr-2 ${tree ? "pl-5" : "pl-2"} ${
          selected ? "bg-action/10 text-action" : "text-ink hover:bg-canvas"
        }"
        aria-current=${selected ? "true" : nothing}
        title="${file.name}"
      >
        <span class="flex shrink-0 ${selected ? "text-action" : "text-muted"}"
          >${icon(file.icon ?? "file-text")}</span
        ><span class="min-w-0 flex-1 truncate">${file.name}</span>${changeStatus(file.status)}
      </div>
    `;
  }
}

customElements.define("file-item", FileItemElement);
