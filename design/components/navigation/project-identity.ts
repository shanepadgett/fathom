import { html } from "lit";

import { icon } from "../../primitives/icon.ts";

export const projectIdentity = (name: string) => html`
  <span class="flex min-w-0 items-center gap-1.5"
    >${icon("folder")}<span class="truncate" title=${name}>${name}</span></span
  >
`;
