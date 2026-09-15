import { html } from "lit";

import "./button.ts";

export const buttonExamples = [
  {
    name: "Primary",
    markup: html`<ds-button><button type="button">Continue</button></ds-button>`,
  },
  {
    name: "Secondary",
    markup: html`
      <ds-button variant="secondary"><button type="button">Continue</button></ds-button>
    `,
  },
  {
    name: "Quiet",
    markup: html`<ds-button variant="quiet"><button type="button">Continue</button></ds-button>`,
  },
  {
    name: "Disabled",
    markup: html`<ds-button><button type="button" disabled>Continue</button></ds-button>`,
  },
];
