import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./change-summary.ts";

const files = [
  ...scenario.changes.files!,
  { path: "tests/session-selection.test.ts", added: 18, removed: 2 },
  { path: "docs/session-renaming.md", added: 10, removed: 0 },
];

export const changeSummaryExamples = [
  { name: "Three changed files", markup: html`<change-summary .changes=${scenario.changes}></change-summary>` },
  { name: "Five files · three shown initially", markup: html`<change-summary .changes=${{ files, count: files.length, added: files.reduce((sum, file) => sum + file.added, 0), removed: files.reduce((sum, file) => sum + file.removed, 0) }}></change-summary>` },
];
