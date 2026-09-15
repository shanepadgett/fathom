import { html } from "lit";

import { meter } from "./meter.ts";

export const meterExamples = [
  {
    name: "Usage",
    markup: html`<div class="flex gap-4">
      ${meter(48, 200, "Context usage")}${
      meter(195, 200, "Context near capacity")
    }
    </div>`,
  },
];
