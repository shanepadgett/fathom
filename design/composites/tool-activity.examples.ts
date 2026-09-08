import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./tool-activity.ts";

export const toolActivityExamples = [
  {
    name: "Tool activity",
    markup: html`
      <tool-activity
        .label=${"Read 3 files"}
        .duration=${"0.8s"}
        .files=${scenario.changedFiles.map((file) => file.name)}
      ></tool-activity>
    `,
  },
];
