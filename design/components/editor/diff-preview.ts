import type { DiffLine } from "../../models/diff.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";

const lineColors = {
  context: "text-muted",
  added: "bg-success/10 text-success",
  removed: "bg-danger/10 text-danger",
};

export class DiffPreviewElement extends DesignElement {
  static override properties = { lines: { attribute: false } };
  declare lines: DiffLine[];

  constructor() {
    super();
    this.lines = [];
  }

  override render() {
    const { lines } = this;
    return html`
      <div class="overflow-auto py-6 font-mono text-sm leading-relaxed">
        ${lines.map((line) => html`<pre class="px-6 ${lineColors[line.kind]}">${line.text}</pre>`)}
      </div>
    `;
  }
}

customElements.define("diff-preview", DiffPreviewElement);
