import { html } from "lit";

import { toolOperations } from "../../fixtures/tool-operations.ts";
import "./tool-summary.ts";

export const toolSummaryExamples = [
  { name: "File operation counts", markup: html`<tool-summary .operations=${toolOperations}></tool-summary>` },
];
