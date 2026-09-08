import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./session-inspector.ts";

export const sessionInspectorExamples = [
  {
    name: "Inspector",
    markup: html`
      <div class="w-sidebar bg-surface">
        <session-inspector .data=${scenario.inspector}></session-inspector>
      </div>
    `,
  },
];
