import { html } from "lit";

import { diffLines } from "../../fixtures/diff.ts";
import { scenario } from "../../fixtures/workspace-scenario.ts";
import "./diff-pane.ts";

export const diffPaneExamples = [
  {
    name: "File diff",
    markup: html`
      <diff-pane
        .path=${scenario.path}
        .lines=${diffLines}
        .count=${scenario.changes.count}
        .added=${12}
        .removed=${4}
      ></diff-pane>
    `,
  },
];
