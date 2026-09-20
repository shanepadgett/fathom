import { html } from "lit";

import "./fathom-wordmark.ts";

export const wordmarkExamples = [
  { name: "Title bar", markup: html`<fathom-wordmark></fathom-wordmark>` },
  {
    name: "Overview",
    markup: html`
      <div class="text-wordmark leading-tight">
        <fathom-wordmark></fathom-wordmark>
      </div>
    `,
  },
];
