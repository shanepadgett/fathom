import type { FileNode } from "../../models/files.ts";

import { html, type TemplateResult } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import "./file-item.ts";
import "./folder-item.ts";

const treeNode = (
  node: FileNode,
  selected: string,
  expanded: string[],
): TemplateResult =>
  node.children
    ? html`<div>
        <folder-item .name=${node.name} .expanded=${
      expanded.includes(node.id)
    }></folder-item>${
      expanded.includes(node.id)
        ? html`<div class="ml-2.5 border-l border-line pl-1.5">
                ${
          node.children.map((child) => treeNode(child, selected, expanded))
        }
              </div>`
        : ""
    }
      </div>`
    : html`
      <file-item .file=${node} .selected=${node.id === selected}
        .tree=${true}></file-item>
    `;

export class FileTreeElement extends DesignElement {
  static override properties = {
    nodes: { attribute: false },
    selected: { type: String },
    expanded: { attribute: false },
  };

  declare nodes: FileNode[];
  declare selected: string;
  declare expanded: string[];

  constructor() {
    super();
    this.nodes = [];
    this.selected = "";
    this.expanded = [];
  }

  override render() {
    const { nodes, selected, expanded } = this;
    return html`
      <div
        data-component="file-tree"
        class="p-2 text-dense leading-none"
        aria-label="File explorer"
      >
        ${nodes.map((node) => treeNode(node, selected, expanded))}
      </div>
    `;
  }
}

customElements.define("file-tree", FileTreeElement);
