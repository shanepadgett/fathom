import type { Tone } from "../../primitives/tone.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { statusDot } from "../../primitives/status-dot.ts";

export class RunStatusElement extends DesignElement {
  static override properties = {
    label: { type: String },
    tone: { attribute: false },
  };

  declare label: string;
  declare tone: Tone;

  constructor() {
    super();
    this.label = "";
    this.tone = "action";
  }

  override render() {
    const { label, tone } = this;
    return html`<span class="flex items-center gap-2">${
      statusDot(tone)
    }${label}</span>`;
  }
}

customElements.define("run-status", RunStatusElement);
