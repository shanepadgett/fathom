import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";

/** The workspace file as it will be written, updated as setup proceeds. */
export class WorkspaceFilePreviewElement extends DesignElement {
  static override properties = {
    path: { type: String },
    text: { type: String },
    status: { type: String },
  };

  declare path: string;
  declare text: string;
  declare status: string;

  constructor() {
    super();
    this.path = "";
    this.text = "";
    this.status = "Draft";
  }

  override render() {
    const lines = this.text.split("\n");
    return html`
      <aside
        aria-label="Workspace file preview"
        class="flex w-104 shrink-0 flex-col border-l border-line bg-surface"
      >
        <header
          class="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4 text-sm">
          <span class="text-muted">${icon("file-code")}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs"
            title=${this
              .path}>${this.path}</span>
          <span
            class="rounded-full border border-line px-2 py-0.5 text-micro text-muted">${this
              .status}</span>
        </header>
        <pre
          class="min-h-0 flex-1 overflow-auto py-3 font-mono text-xs leading-relaxed"
        >${lines.map((line, index) =>
          html`<div class="flex"><span
              class="w-10 shrink-0 select-none pr-3 text-right text-muted/60"
            >${index + 1}</span><span class="${
            line.startsWith("#")
              ? "text-muted"
              : line.startsWith("[")
              ? "text-action"
              : "text-ink"
          }">${line || " "}</span></div>`
        )}</pre>
      </aside>
    `;
  }
}

customElements.define("workspace-file-preview", WorkspaceFilePreviewElement);
