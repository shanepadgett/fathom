import type { Workspace } from "../../models/workspace.ts";

import { html } from "lit";

import { icon } from "../../primitives/icon.ts";

/** Names the current workspace at the top of the sessions sidebar. */
export const workspaceTitle = (workspace: Workspace) =>
  html`
    <button
      type="button"
      aria-label="${workspace.name} workspace options"
      class="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4 text-left hover:bg-canvas"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">${workspace
          .name}</span>
        <span
          class="block truncate text-micro text-muted">${workspace.folders
            .length} folders · ${workspace.file?.split("/").at(-1) ??
            "not saved"}</span>
      </span>
      <span class="text-muted">${icon("caret-down", "small")}</span>
    </button>
  `;
