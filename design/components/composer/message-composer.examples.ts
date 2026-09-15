import { html } from "lit";

import { scenario } from "../../fixtures/workspace-scenario.ts";
import "./message-composer.ts";

export const messageComposerExamples = [
  {
    name: "Standard",
    markup: html`
      <message-composer
        .model=${scenario.model}
        .reasoning=${scenario.reasoning}
      ></message-composer>
    `,
  },
  {
    name: "Narrow",
    markup: html`
      <div class="w-files-sidebar">
        <message-composer
          .model=${scenario.model}
          .reasoning=${scenario.reasoning}
        ></message-composer>
      </div>
    `,
  },
];
