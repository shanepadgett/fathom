import type { CodeLine } from "../../models/code.ts";
import type { FileNode } from "../../models/files.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import "./code-preview.ts";
import "./editor-status-bar.ts";
import "./editor-tabs.ts";
import "./file-breadcrumbs.ts";

export class EditorPaneElement extends DesignElement {
  static override properties = {
    files: { attribute: false },
    selected: { type: String },
    path: { attribute: false },
    lines: { attribute: false },
  };

  declare files: FileNode[];
  declare selected: string;
  declare path: string[];
  declare lines: CodeLine[];

  constructor() {
    super();
    this.files = [];
    this.selected = "";
    this.path = [];
    this.lines = [];
  }

  override render() {
    const { files, selected, path, lines } = this;
    return html`
      <section
        data-component="editor-pane"
        class="flex min-w-0 flex-1 flex-col"
        aria-label="Code editor"
      >
        <editor-tabs .files=${files} .selected=${selected}></editor-tabs>
        <file-breadcrumbs .path=${path}></file-breadcrumbs>
        <code-preview .lines=${lines}></code-preview>
        <editor-status-bar></editor-status-bar>
      </section>
    `;
  }
}

customElements.define("editor-pane", EditorPaneElement);
