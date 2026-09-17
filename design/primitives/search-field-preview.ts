import { html } from "lit";

import { icon } from "./icon.ts";

export const searchFieldPreview = (placeholder: string, searchIcon = false, scope = "") => html`
  <div class="flex h-14 items-center gap-3 px-5 text-sm text-muted">
    ${searchIcon ? icon("magnifying-glass") : ""}<span
      class="flex min-w-0 items-center"
      data-search-prompt
      ><span class="h-5 w-px shrink-0 bg-action" aria-hidden="true"></span
      ><span class="truncate">${placeholder}</span></span
    >${scope ? html`<span class="ml-auto shrink-0 text-xs">${scope}</span>` : ""}
  </div>
`;
