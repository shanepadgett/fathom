import { systemStatus } from "../fixtures/system-status.ts";
import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./workspace-status-bar.ts";

export const workspaceStatusBarExamples = [
  {
    name: "Agents running",
    markup: html`
      <workspace-status-bar
        .system=${systemStatus}
        .context=${scenario.context}
      ></workspace-status-bar>
    `,
  },
  {
    name: "All quiet",
    markup: html`<workspace-status-bar .system=${{ runningAgents: 0 }} .context=${scenario.context}></workspace-status-bar>`,
  },
];
