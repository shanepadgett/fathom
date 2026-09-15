import { html } from "lit";

import { diffLines } from "../../fixtures/diff.ts";
import "./diff-preview.ts";

export const diffPreviewExamples = [
  {
    name: "Changed lines",
    markup: html`<diff-preview .lines=${diffLines}></diff-preview>`,
  },
];
