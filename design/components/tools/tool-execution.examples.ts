import { html } from "lit";

import {
  completedToolBatch,
  toolExecutionFrames,
} from "../../fixtures/tool-execution.ts";
import "./tool-execution.ts";
import "./tool-execution-demo.ts";

export const toolExecutionExamples = [
  {
    name: "Live execution · repeating preview",
    markup:
      html`<tool-execution-demo .frames=${toolExecutionFrames}></tool-execution-demo>`,
  },
  {
    name: "Completed batch · expand to inspect",
    markup:
      html`<tool-execution .batch=${completedToolBatch}></tool-execution>`,
  },
  {
    name: "Thinking after a tool",
    markup: html`<tool-execution .batch=${
      toolExecutionFrames[2]
    }></tool-execution>`,
  },
];
