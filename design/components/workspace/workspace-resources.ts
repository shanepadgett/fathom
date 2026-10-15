import type {
  ServiceState,
  WorkspaceFolder,
  WorkspaceService,
} from "../../models/workspace.ts";
import type { Tone } from "../../primitives/tone.ts";

import { html, nothing } from "lit";

import { icon } from "../../primitives/icon.ts";
import { statusDot } from "../../primitives/status-dot.ts";

const serviceTone: Record<ServiceState, Tone> = {
  running: "success",
  starting: "action",
  stopped: "neutral",
  failed: "danger",
};

const serviceLabel: Record<ServiceState, string> = {
  running: "Running",
  starting: "Starting",
  stopped: "Stopped",
  failed: "Failed",
};

/** One workspace folder as a session sees it: branch and edits. */
export const folderStatus = (folder: WorkspaceFolder) =>
  html`
    <div class="min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="text-muted">${icon("folder")}</span>
          <span class="truncate font-medium">${folder.name}</span>
        </span>
        ${folder.access === "read"
          ? html`
            <span
              class="flex items-center gap-1 text-micro text-muted">${icon(
                "lock-simple",
                "small",
              )}Read only</span>
          `
          : folder.changes
          ? html`
            <span class="font-mono text-micro"><span class="text-success"
              >+${folder.changes.added}</span> <span class="text-danger"
              >−${folder.changes.removed}</span></span>
          `
          : html`<span class="text-micro text-muted">No changes</span>`}
      </div>
      ${folder.branch
        ? html`
          <p
            class="mt-1 flex min-w-0 items-center gap-1.5 pl-5 text-micro text-muted"
          >
            ${icon("git-branch", "small")}<span class="truncate">${folder
              .branch}</span>
          </p>
        `
        : nothing}
    </div>
  `;

/** A process the workspace runs so agents can test folders together. */
export const serviceStatus = (service: WorkspaceService) =>
  html`
    <div class="flex min-w-0 items-center gap-2">
      ${statusDot(serviceTone[service.state], serviceLabel[service.state])}
      <span class="truncate">${service.name}</span>
      ${service.port
        ? html`<span class="font-mono text-micro text-muted">:${service.port}</span>`
        : nothing}
      <span
        class="ml-auto shrink-0 text-micro ${service.state === "starting"
          ? "text-action"
          : "text-muted"}"
      >${serviceLabel[service.state]}</span>
    </div>
  `;
