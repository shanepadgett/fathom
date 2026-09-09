import { html } from "lit";

import { contextUsage } from "../fixtures/context-usage.ts";
import "./context-usage.ts";

export const contextUsageExamples = [
  {
    name: "Context breakdown · Open",
    markup: html`<div class="flex h-96 items-end justify-end bg-surface p-4">
      <context-usage open .data=${contextUsage}></context-usage>
    </div>`,
  },
];
