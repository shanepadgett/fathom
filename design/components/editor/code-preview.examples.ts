import { html } from "lit";

import { codeLines } from "../../fixtures/code.ts";
import "./code-preview.ts";

export const codePreviewExamples = [
  { name: "Numbered code", markup: html`<code-preview .lines=${codeLines}></code-preview>` },
];
