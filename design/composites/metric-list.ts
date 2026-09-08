import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class MetricListElement extends DesignElement {
  static override properties = { metrics: { attribute: false } };
  declare metrics: [string, string][];

  constructor() {
    super();
    this.metrics = [];
  }

  override render() {
    const { metrics } = this;
    return html`<dl class="flex flex-col gap-3">
      ${metrics.map(
        ([label, value]) => html`
          <div class="flex justify-between gap-3">
            <dt>${label}</dt>
            <dd>${value}</dd>
          </div>
        `,
      )}
    </dl>`;
  }
}

customElements.define("metric-list", MetricListElement);
