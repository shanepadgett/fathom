import { html } from "lit";

import { icon } from "../../primitives/icon.ts";

/** Workspace folders a session has changed; empty means no edits yet. */
export const foldersIdentity = (folders: string[]) =>
  html`
    <span class="flex min-w-0 items-center gap-1.5"
    >${icon(folders.length > 1 ? "folders" : "folder")}<span
        class="truncate"
        title=${folders.join(", ") || "No changes yet"}
      >${folders.join(" · ") || "No changes yet"}</span></span>
  `;

export const projectIdentity = (name: string) =>
  html`
    <span class="flex min-w-0 items-center gap-1.5"
    >${icon("folder")}<span class="truncate" title=${name}>${name}</span></span>
  `;
