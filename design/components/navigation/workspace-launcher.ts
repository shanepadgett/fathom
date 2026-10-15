import type { Workspace } from "../../models/workspace.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { shortcutHint } from "../../primitives/shortcut-hint.ts";
import { workspaceGlyph } from "../workspace/workspace-tabs.ts";
import { folderNames, openActions } from "./workspace-switcher.ts";

const workspaceState = (workspace: Workspace, open: boolean) =>
  workspace.running
    ? html`<span class="text-action">${workspace.running} running</span>`
    : workspace.activity === "attention"
    ? html`<span class="text-warning">Needs input</span>`
    : open
    ? html`<span>Open</span>`
    : html`<span>${workspace.opened}</span>`;

/** What a new tab shows before it holds a workspace. */
export class WorkspaceLauncherElement extends DesignElement {
  static override properties = {
    workspaces: { attribute: false },
    open: { attribute: false },
  };

  declare workspaces: Workspace[];
  declare open: string[];

  constructor() {
    super();
    this.workspaces = [];
    this.open = [];
  }

  override render() {
    const { workspaces, open } = this;
    return html`
      <div class="min-h-0 flex-1 overflow-y-auto bg-canvas">
        <div class="mx-auto flex max-w-transcript flex-col gap-8 px-8 pb-16 pt-14">
          <div>
            <h1 class="text-2xl font-medium tracking-tight">Open a workspace</h1>
            <p class="mt-1 text-sm text-muted">
              A workspace is a set of folders that agents read, edit, run, and
              test together.
            </p>
          </div>

          <div
            class="flex h-11 items-center gap-3 rounded-lg border border-control-line px-4 text-sm text-muted"
          >
            ${icon("magnifying-glass")}<span class="flex-1"
            >Search workspaces and folders…</span>${shortcutHint(
              ["⌘", "O"],
              "",
            )}
          </div>

          <div class="grid grid-cols-4 gap-3">
            ${openActions.map((action, index) =>
              html`
                <button
                  type="button"
                  class="flex flex-col items-start gap-3 rounded-lg border p-4 text-left ${index ===
                      0
                    ? "border-action/50 bg-action/5"
                    : "border-line hover:bg-surface"}"
                >
                  <span class=${index === 0
                    ? "text-action"
                    : "text-muted"}>${icon(
                      action.icon,
                      "toolbar",
                    )}</span>
                  <span>
                    <span class="block text-sm font-medium">${action
                      .label}</span>
                    <span class="mt-1 block text-xs text-muted">${action
                      .detail}</span>
                  </span>
                </button>
              `
            )}
          </div>

          <section aria-label="Recent workspaces">
            <h2 class="mb-2 flex items-center justify-between text-sm text-muted">
              <span>Recent</span><span class="text-xs">Drop folders here to start a
                workspace with them</span>
            </h2>
            <div class="divide-y divide-line rounded-lg border border-line">
              ${workspaces.map((workspace) =>
                html`
                  <div class="flex items-center gap-4 px-4 py-3 hover:bg-surface">
                    <span class="flex w-5 justify-center">${workspaceGlyph(
                      workspace,
                    )}</span>
                    <div class="w-56 min-w-0 shrink-0">
                      <p class="truncate text-sm">${workspace.name}</p>
                      <p class="mt-0.5 truncate text-xs text-muted" title=${workspace
                        .file ?? workspace.folders[0].path}>
                        ${workspace.file ?? "Folder · not saved as a workspace"}
                      </p>
                    </div>
                    <p class="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                      ${folderNames(workspace)}
                    </p>
                    <span class="w-24 shrink-0 text-right text-xs text-muted">${workspaceState(
                      workspace,
                      open.includes(workspace.id),
                    )}</span>
                  </div>
                `
              )}
            </div>
          </section>
        </div>
      </div>
    `;
  }
}

customElements.define("workspace-launcher", WorkspaceLauncherElement);
