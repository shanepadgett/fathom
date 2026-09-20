import { html } from "lit";

import { icon } from "../../primitives/icon.ts";

export const branchIdentity = (branch: string) =>
  html`
    <span class="flex min-w-0 items-center gap-1.5"
    >${icon(
      "git-branch",
    )}<span class="truncate" title=${branch}>${branch}</span></span>
  `;
