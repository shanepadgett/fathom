import type { CodeLine } from "../models/code.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { tones } from "../primitives/tone.ts";

export class CodePreviewElement extends DesignElement {
  static override properties = { lines: { attribute: false } };
  declare lines: CodeLine[];

  constructor() {
    super();
    this.lines = [];
  }

  override render() {
    const { lines } = this;
    return html`
      <div class="flex min-h-0 flex-1 overflow-auto py-4">
        <pre
          class="select-none border-r border-line px-4 text-right font-mono text-sm leading-relaxed text-muted"
          aria-hidden="true"
          .textContent=${lines.map((_, index) => index + 1).join("\n")}
        ></pre>
        <pre
          class="whitespace-normal px-6 font-mono text-sm leading-relaxed"
          aria-label="Sample TypeScript code"
        >
      ${lines.map(
            (line) => html`
              <span class="block whitespace-pre ${line.added ? "bg-success/10" : ""}"
                >${line.tokens.map((token) =>
                  typeof token === "string"
                    ? token
                    : html`<span class=${tones[token.tone]}>${token.text}</span>`,
                )}</span
              >
            `,
          )}</pre>
      </div>
    `;
  }
}

customElements.define("code-preview", CodePreviewElement);
