import type { Workspace } from "../../models/workspace.ts";
import type { IconName } from "../../primitives/icon.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { searchFieldPreview } from "../../primitives/search-field-preview.ts";
import { workspaceGlyph } from "../workspace/workspace-tabs.ts";
import { resultFrame } from "./search-result-frame.ts";
import "./search-surface.ts";

/** Ways to get a workspace that is not in the recent list. */
export const openActions: { icon: IconName; label: string; detail: string }[] =
  [
    {
      icon: "folder-plus",
      label: "New workspace",
      detail: "Choose folders that agents work across together",
    },
    {
      icon: "arrow-square-in",
      label: "Open workspace file",
      detail: "A .fathom file from disk or a repository",
    },
    {
      icon: "folder-open",
      label: "Open folder",
      detail: "One folder now; add more folders later",
    },
    {
      icon: "cloud-arrow-down",
      label: "Clone repositories",
      detail: "Clone one or more repositories into a new workspace",
    },
  ];

export const folderNames = (workspace: Workspace) =>
  workspace.folders.map((folder) => folder.name).join(" · ");

/** ⌘O: switch to an open tab, reopen a recent workspace, or start a new one. */
export class WorkspaceSwitcherElement extends DesignElement {
  static override properties = {
    workspaces: { attribute: false },
    open: { attribute: false },
  };

  declare workspaces: Workspace[];
  /** IDs of workspaces already open as tabs. */
  declare open: string[];

  constructor() {
    super();
    this.workspaces = [];
    this.open = [];
  }

  override render() {
    const { workspaces, open } = this;
    return html`
      <div role="dialog" aria-modal="true" aria-label="Open workspace">
        <search-surface
          label="Open workspace"
          heading="Workspaces"
          .field=${searchFieldPreview("Search workspaces and folders…")}
          .results=${html`
            ${workspaces.map((workspace, index) =>
              resultFrame(
                html`<span class="flex w-6 justify-center text-lg">${
                  workspaceGlyph(workspace)
                }</span>`,
                html`
                  <p class="truncate text-sm">${workspace.name}</p>
                  <p class="mt-0.5 truncate font-mono text-xs text-muted">
                    ${folderNames(workspace)}
                  </p>
                `,
                open.includes(workspace.id)
                  ? `Open tab · ⌘${open.indexOf(workspace.id) + 1}`
                  : workspace.opened ?? "",
                index === 0,
              )
            )}
            <h3 class="mt-2 border-t border-line px-3 pb-2 pt-3 text-xs text-muted">
              Add a workspace
            </h3>
            <div class="grid grid-cols-2 gap-1">
              ${openActions.map((action) =>
                html`
                  <div
                    class="flex items-center gap-3 rounded-control px-3 py-2 text-sm hover:bg-surface">
                    <span class="text-muted">${icon(
                      action.icon,
                      "large",
                    )}</span>
                    <span class="truncate">${action.label}</span>
                  </div>
                `
              )}
            </div>
          `}
          action="Open"
        ></search-surface>
      </div>
    `;
  }
}

customElements.define("workspace-switcher", WorkspaceSwitcherElement);
