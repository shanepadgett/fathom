import { html } from "lit";

import "../../primitives/button.ts";
import { icon } from "../../primitives/icon.ts";

export const projectSelector = (label: string) =>
  html`
    <ds-button variant="secondary" size="project"
    ><button type="button">
        ${icon("folder")}<span class="flex-1 text-left">${label}</span>${icon(
          "caret-down",
        )}
      </button></ds-button>
  `;
