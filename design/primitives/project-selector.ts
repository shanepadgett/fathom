import { html } from "lit";

import "../components/button.ts";
import { icon } from "./icon.ts";

export const projectSelector = (label: string) => html`
  <ds-button variant="secondary" size="project"
    ><button type="button">
      ${icon("folder")}<span class="flex-1 text-left">${label}</span>${icon("caret-down")}
    </button></ds-button
  >
`;
