import type { ToolOperation } from "../../models/conversation.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";

export class ToolSummaryElement extends DesignElement {
  static override properties = { operations: { attribute: false } };
  declare operations: ToolOperation[];

  constructor() {
    super();
    this.operations = [];
  }

  override render() {
    const counts = (["read", "edited", "written"] as const).map((action) => ({
      action,
      files: [
        ...new Set(
          this.operations.filter((operation) => operation.action === action)
            .flatMap((operation) => operation.files),
        ),
      ],
    })).filter((operation) => operation.files.length);
    return html`
      <details class="group text-sm text-muted">
        <summary class="flex items-baseline gap-2 py-2">
          <span class="group-open:rotate-90">${icon(
            "caret-right",
            "small",
          )}</span>
          <span>${counts.map(({ action, files }) =>
            `${files.length} ${files.length === 1 ? "file" : "files"} ${action}`
          ).join(" · ") || "No file operations yet"}</span>
        </summary>
        <div class="ml-4 space-y-3 border-l border-line py-2 pl-4">
              ${counts.map(({ action, files }) =>
                html`
                  <div>
                    <p class="mb-1 capitalize">${action}</p>
                    <ul class="space-y-1 font-mono">${files.map((file) =>
                      html`<li class="break-words">${file}</li>`
                    )}</ul>
                  </div>
                `
              )}
            </div>
      </details>
    `;
  }
}

customElements.define("tool-summary", ToolSummaryElement);
