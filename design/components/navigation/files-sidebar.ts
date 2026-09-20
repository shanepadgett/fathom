import type { Changes, FileNode } from "../../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { tabStrip } from "../../primitives/tab-strip.ts";
import "../editor/changed-files-list.ts";
import "./file-tree.ts";

export class FilesSidebarElement extends DesignElement {
  static override properties = {
    nodes: { attribute: false },
    changed: { attribute: false },
    selected: { type: String },
    expanded: { attribute: false },
    changes: { attribute: false },
    view: { type: String },
  };

  declare nodes: FileNode[];
  declare changed: FileNode[];
  declare selected: string;
  declare expanded: string[];
  declare changes: Changes;
  declare view: "files" | "changes";

  constructor() {
    super();
    this.nodes = [];
    this.changed = [];
    this.selected = "";
    this.expanded = [];
    this.view = "files";
  }

  override render() {
    if (!this.changes) {
      return nothing;
    }
    const { nodes, changed, selected, expanded, changes, view } = this;
    return html`${
      tabStrip(
        [
          { id: "files", label: "Files" },
          { id: "changes", label: "Changes" },
        ],
        view,
        "Files and changes",
      )
    }${
      view === "files"
        ? html`
          <file-tree .nodes=${nodes} .selected=${selected}
            .expanded=${expanded}></file-tree>
        `
        : html`
          <changed-files-list
            .files=${changed}
            .selected=${selected}
            .changes=${changes}
          ></changed-files-list>
        `
    }`;
  }
}

customElements.define("files-sidebar", FilesSidebarElement);
