import type { FileNode } from "../../models/files.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import "./editor-tab.ts";

export class EditorTabsElement extends DesignElement {
  static override properties = {
    files: { attribute: false },
    selected: { type: String },
  };

  declare files: FileNode[];
  declare selected: string;

  constructor() {
    super();
    this.files = [];
    this.selected = "";
  }

  override render() {
    const { files, selected } = this;
    return html`
      <div
        class="flex h-9 shrink-0 overflow-hidden border-b border-line bg-surface text-sm"
        role="group"
        aria-label="Open files"
      >
        ${files.map(
          (file) => html`<editor-tab .file=${file} .selected=${file.id === selected}></editor-tab>`,
        )}
      </div>
    `;
  }
}

customElements.define("editor-tabs", EditorTabsElement);
