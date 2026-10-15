import type { Workspace } from "../../models/workspace.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { workspaceSummary } from "./workspace-tabs.ts";

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const badge = (workspace: Workspace) =>
  workspace.activity === "running"
    ? html`
      <span
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 font-mono text-micro leading-none text-on-action ring-2 ring-surface"
      >${workspace.running}</span>
    `
    : workspace.activity === "attention"
    ? html`
      <span
        class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-surface"
      ></span>
    `
    : nothing;

/** Vertical alternative to title-bar tabs: one tile per open workspace. */
export class WorkspaceRailElement extends DesignElement {
  static override properties = {
    workspaces: { attribute: false },
    selected: { type: String },
  };

  declare workspaces: Workspace[];
  declare selected: string;

  constructor() {
    super();
    this.workspaces = [];
    this.selected = "";
  }

  override render() {
    const { workspaces, selected } = this;
    return html`
      <nav
        aria-label="Open workspaces"
        class="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-line bg-surface py-3"
      >
        ${workspaces.map((workspace, index) => {
          const isSelected = workspace.id === selected;
          return html`
            <div class="relative flex w-full justify-center">
              ${isSelected
                ? html`<span class="absolute left-0 top-1.5 h-6 w-1 rounded-r-full bg-action"></span>`
                : nothing}
              <button
                type="button"
                aria-current=${isSelected ? "true" : nothing}
                aria-label=${workspaceSummary(workspace)}
                title="${workspaceSummary(workspace)} · ⌘${index + 1}"
                class="relative flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium ${isSelected
                  ? "border-action/40 bg-action/10 text-action"
                  : "border-line bg-canvas text-muted hover:text-ink"}"
              >
                ${monogram(workspace.name)}${badge(workspace)}
              </button>
            </div>
          `;
        })}
        <div class="w-6 border-t border-line"></div>
        <button
          type="button"
          aria-label="Open or create a workspace (⌘O)"
          title="Open or create a workspace (⌘O)"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-control-line text-muted hover:text-ink"
        >${icon("plus")}</button>
      </nav>
    `;
  }
}

customElements.define("workspace-rail", WorkspaceRailElement);
