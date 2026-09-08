import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

export class FolderItemElement extends DesignElement {
  static override properties = {
    name: { type: String },
    expanded: { type: Boolean },
  };

  declare name: string;
  declare expanded: boolean;

  constructor() {
    super();
    this.name = "";
    this.expanded = false;
  }

  override render() {
    const { name, expanded } = this;
    return html`
      <button
        type="button"
        class="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-canvas"
        aria-expanded="${expanded}"
      >
        <span class="flex items-center gap-1.5 text-muted"
          >${icon(expanded ? "caret-down" : "caret-right", "small")}${icon(
            expanded ? "folder-open" : "folder",
          )}</span
        ><span class="truncate">${name}</span>
      </button>
    `;
  }
}

customElements.define("folder-item", FolderItemElement);
