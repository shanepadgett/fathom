import type { FileNode } from "../../models/files.ts";
import type { WorkspaceFolder } from "../../models/workspace.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import "./file-tree.ts";

/**
 * Multi-root file tree: one collapsible root per workspace folder, labelled
 * with the folder name and its branch, since branches can differ per folder.
 */
export class WorkspaceFileRootsElement extends DesignElement {
  static override properties = {
    folders: { attribute: false },
    nodes: { attribute: false },
    selected: { type: String },
    expanded: { attribute: false },
  };

  declare folders: WorkspaceFolder[];
  declare nodes: FileNode[];
  declare selected: string;
  declare expanded: string[];

  constructor() {
    super();
    this.folders = [];
    this.nodes = [];
    this.selected = "";
    this.expanded = [];
  }

  override render() {
    const { folders, nodes, selected, expanded } = this;
    return html`
      <div
        class="flex h-9 shrink-0 items-center justify-between border-b border-line px-3 text-sm">
        <span class="font-medium">Folders</span>
        <button type="button" aria-label="Add folder to workspace"
          title="Add folder to workspace"
          class="flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink">${icon(
            "folder-plus",
          )}</button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        ${folders.map((folder) => {
          const root = nodes.find((node) => node.id === folder.name);
          const open = expanded.includes(folder.name);
          return html`
            <section aria-label="${folder
              .name} folder" class="border-b border-line">
              <div class="flex items-center gap-1.5 px-2 py-2 text-dense" title=${folder
                .path}>
                <span class="text-muted">${icon(
                  open ? "caret-down" : "caret-right",
                  "small",
                )}</span>
                <span class="font-medium">${folder.name}</span>
                ${folder.access === "read"
                  ? html`<span class="text-muted" title="Read only">${
                    icon(
                      "lock-simple",
                      "small",
                    )
                  }</span>`
                  : nothing}
                <span class="ml-auto flex min-w-0 items-center gap-1 text-micro text-muted">
                  ${icon("git-branch", "small")}<span class="truncate">${folder
                    .branch}</span>
                </span>
              </div>
              ${open && root?.children
                ? html`
                  <div class="-mt-2">
                    <file-tree
                      .nodes=${root.children}
                      .selected=${selected}
                      .expanded=${expanded}
                    ></file-tree>
                  </div>
                `
                : nothing}
            </section>
          `;
        })}
      </div>
    `;
  }
}

customElements.define("workspace-file-roots", WorkspaceFileRootsElement);
