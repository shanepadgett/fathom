import type { Changes, FileNode } from "../../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { diffStat } from "./diff-stat.ts";
import { emptyState } from "../../primitives/empty-state.ts";
import "../navigation/file-item.ts";

export class ChangedFilesListElement extends DesignElement {
  static override properties = {
    files: { attribute: false },
    selected: { type: String },
    changes: { attribute: false },
  };

  declare files: FileNode[];
  declare selected: string;
  declare changes: Changes;

  constructor() {
    super();
    this.files = [];
    this.selected = "";
  }

  override render() {
    if (!this.changes) {
      return nothing;
    }
    const { files, selected, changes } = this;
    return html`
      <div data-component="changed-files" class="p-2 text-dense"
        aria-label="Changed files">
        <p class="flex flex-wrap items-center gap-2 px-2 pb-2 text-muted">
          ${files.length} files changed ${diffStat(
            changes.added,
            changes.removed,
          )}
        </p>
        ${files.length
          ? files.map(
            (file) =>
              html`<file-item .file=${file} .selected=${
                file.id === selected
              }></file-item>`,
          )
          : emptyState("No changed files")}
      </div>
    `;
  }
}

customElements.define("changed-files-list", ChangedFilesListElement);
