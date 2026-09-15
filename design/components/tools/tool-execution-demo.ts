import type { ToolBatch } from "../../models/tool-execution.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import "./tool-execution.ts";

// Only the preview cycles state; the execution component receives presentation data.
export class ToolExecutionDemoElement extends DesignElement {
  static override properties = {
    frames: { attribute: false },
    frame: { state: true },
  };
  declare frames: ToolBatch[];
  declare private frame: number;
  private timer?: ReturnType<typeof setInterval>;
  private motion?: MediaQueryList;
  private syncMotion = () => {
    clearInterval(this.timer);
    if (!this.motion?.matches) {
      this.timer = setInterval(() => {
        this.frame = (this.frame + 1) % Math.max(this.frames.length, 1);
      }, 2400);
    }
  };

  constructor() {
    super();
    this.frames = [];
    this.frame = 0;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.motion.addEventListener("change", this.syncMotion);
    this.syncMotion();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.timer);
    this.motion?.removeEventListener("change", this.syncMotion);
  }

  override render() {
    return this.frames.length
      ? html`<tool-execution .batch=${
        this.frames[this.frame % this.frames.length]
      }></tool-execution>`
      : nothing;
  }
}

customElements.define("tool-execution-demo", ToolExecutionDemoElement);
