import { html } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import { DesignElement } from "../components/design-element.ts";

export class StreamingResponseElement extends DesignElement {
  static override properties = { text: { type: String } };
  declare text: string;

  constructor() {
    super();
    this.text = "";
  }

  override render() {
    // Small, uneven chunks approximate provider deltas, including partial words.
    const chunks: string[] = [];
    const sizes = [1, 3, 2, 4, 2];
    for (let offset = 0; offset < this.text.length;) {
      const size = sizes[chunks.length % sizes.length];
      chunks.push(this.text.slice(offset, offset + size));
      offset += size;
    }
    return html`<p>
      <span class="sr-only">${this.text}</span>
      <span aria-hidden="true">${chunks.map((chunk, index) => html`<span
        class="streaming-response-chunk"
        style=${styleMap({ "--word-reveal": `${index / Math.max(chunks.length, 1) * 38}%` })}
      >${chunk}</span>`)}</span>
    </p>`;
  }
}

customElements.define("streaming-response", StreamingResponseElement);
