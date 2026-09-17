import { html } from "lit";

import "./metric-list.ts";

export const metricListExamples = [
  {
    name: "Label and value pairs",
    markup: html`<metric-list
      .metrics=${[
        ["Model", "Claude Sonnet"],
        ["Tokens", "48,000 / 200,000"],
      ]}
    ></metric-list>`,
  },
];
