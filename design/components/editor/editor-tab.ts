import type { FileNode } from "../../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { iconButton } from "../../primitives/icon-button.ts";
import { changeStatus } from "./change-status.ts";

export class EditorTabElement extends DesignElement {
  static override properties = {
    file: { attribute: false },
    selected: { type: Boolean },
  };

  declare file: FileNode;
  declare selected: boolean;

  constructor() {
    super();
    this.selected = false;
  }

  override render() {
    if (!this.file) {
      return nothing;
    }
    const { file, selected } = this;
    return html`
      <div
        class="flex items-center gap-3 border-r border-line px-4 ${
          selected ? "border-t-2 border-t-action bg-canvas" : "text-muted"
        }"
      >
        <button type="button" aria-pressed="${selected}" class="truncate">${file.name}</button
        >${changeStatus(file.status)}${iconButton("x", `Close ${file.name}`)}
      </div>
    `;
  }
}

customElements.define("editor-tab", EditorTabElement);
