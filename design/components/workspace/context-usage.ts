import type { ContextUsage } from "../../models/context-usage.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";

export class ContextUsageElement extends DesignElement {
  static override properties = {
    data: { attribute: false },
    open: { type: Boolean },
  };

  declare data: ContextUsage;
  declare open: boolean;

  constructor() {
    super();
    this.open = false;
  }

  override render() {
    if (!this.data) return nothing;
    const { value, maximum, segments = [] } = this.data;
    const total = Math.max(maximum, value, 1);
    return html`<div class="context-usage relative">
      <div class="flex items-center gap-3 py-2">
        <span
          class="relative h-3 w-32 rounded-sm bg-line"
          role="meter"
          aria-label="Context tokens"
          aria-valuemin="0"
          aria-valuemax=${maximum}
          aria-valuenow=${Math.min(value, maximum)}
          aria-valuetext=${`${value}k of ${maximum}k tokens`}
        >
          <span
            class="block h-full rounded-sm bg-action"
            style="width:${(value / total) * 100}%"
          ></span>
          <span
            class="context-compaction-marker absolute -top-1 -bottom-1 border-l border-ink"
            aria-hidden="true"
          ></span>
        </span>
        <span class="whitespace-nowrap">${value}k / ${maximum}k</span>
      </div>
      ${
        this.open
          ? html`
              <div
                class="context-usage-popover absolute bottom-full right-0 z-20 w-72 rounded-lg border border-line bg-surface p-4 text-dense text-ink shadow-menu"
                role="region"
                aria-label="Context breakdown"
              >
                <div class="mb-4 flex items-center justify-between gap-4">
                  <strong class="font-medium">Context breakdown</strong
                  ><span class="text-muted">${Math.round((value / maximum) * 100)}% used</span>
                </div>
                <div class="flex flex-col gap-3">
                  ${segments.map(
                    (segment) =>
                      html`<div class="flex items-center gap-2">
                        <span class="flex-1">${segment.label}</span><span>${segment.value}k</span>
                      </div>`,
                  )}
                </div>
                <div class="mt-4 flex justify-between border-t border-line pt-3">
                  <span class="text-muted">Available</span
                  ><span>${Math.max(0, maximum - value)}k</span>
                </div>
              </div>
            `
          : nothing
      }
    </div>`;
  }
}

customElements.define("context-usage", ContextUsageElement);
