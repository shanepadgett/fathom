import { html } from "lit";

import "./accordion.ts";

const items = html`
  <details open>
    <summary>Session context</summary>
    <div>
      <p>The current task, working directory, and branch stay with this session.</p>
    </div>
  </details>
  <details>
    <summary>Changed files</summary>
    <div>
      <p>Review edits before keeping them. Each file shows the changes made during this session.</p>
    </div>
  </details>
  <details>
    <summary>Tool permissions</summary>
    <div>
      <p>Choose which actions need approval before a tool can run.</p>
    </div>
  </details>
`;

export const accordionExamples = [
  {
    name: "One open at a time",
    markup: html`<ds-accordion>${items}</ds-accordion>`,
  },
  {
    name: "Multiple open",
    markup: html`<ds-accordion multiple>${items}</ds-accordion>`,
  },
];
