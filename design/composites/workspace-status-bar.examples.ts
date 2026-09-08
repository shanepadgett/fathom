import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./workspace-status-bar.ts";

export const workspaceStatusBarExamples = [
  {
    name: "Footer",
    markup: html`
      <workspace-status-bar
        .status=${"Reviewing changes"}
        .changed=${scenario.changes.count}
        .context=${scenario.context}
      ></workspace-status-bar>
    `,
  },
];
