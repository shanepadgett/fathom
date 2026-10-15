import type { Workspace } from "../../models/workspace.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { iconButton } from "../../primitives/icon-button.ts";
import { icon } from "../../primitives/icon.ts";

/** Leading glyph: agent activity wins over the folder-count glyph. */
export const workspaceGlyph = (workspace: Workspace) =>
  workspace.activity === "running"
    ? html`
      <span class="inline-flex text-action motion-safe:animate-session-spin"
        role="img" aria-label="Agents running">${icon("spinner-gap")}</span>
    `
    : workspace.activity === "attention"
    ? html`
      <span class="inline-flex text-warning" role="img"
        aria-label="Needs your input">${icon("chat-circle-text")}</span>
    `
    : html`<span class="inline-flex text-muted">${
      icon(workspace.folders.length > 1 ? "folders" : "folder")
    }</span>`;

export const workspaceSummary = (workspace: Workspace) =>
  [
    workspace.name,
    workspace.folders.length === 1
      ? "1 folder"
      : `${workspace.folders.length} folders`,
    workspace.running
      ? `${workspace.running} agent${workspace.running > 1 ? "s" : ""} running`
      : "",
  ].filter(Boolean).join(" · ");

const tabClass = (selected: boolean) =>
  `group flex h-8 min-w-0 max-w-56 shrink items-center gap-2 rounded-control border pl-2.5 pr-1 text-dense ${
    selected
      ? "border-line bg-canvas text-ink"
      : "border-transparent text-muted hover:bg-canvas/60 hover:text-ink"
  }`;

const closeButton = (label: string, selected: boolean) =>
  html`
    <button
      type="button"
      aria-label="Close ${label}"
      title="Close ${label}"
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-ink ${selected
        ? ""
        : "invisible group-hover:visible"}"
    >${icon("x", "small")}</button>
  `;

/**
 * Title-bar tabs. Each tab is one open workspace; a pending tab is a new tab
 * that has not become a workspace yet.
 */
export class WorkspaceTabsElement extends DesignElement {
  static override properties = {
    workspaces: { attribute: false },
    selected: { type: String },
    pending: { type: String },
  };

  declare workspaces: Workspace[];
  declare selected: string;
  declare pending: string;

  constructor() {
    super();
    this.workspaces = [];
    this.selected = "";
    this.pending = "";
  }

  override render() {
    const { workspaces, selected, pending } = this;
    return html`
      <div role="tablist" aria-label="Open workspaces"
        class="flex min-w-0 items-center gap-1">
        ${workspaces.map((workspace, index) => {
          const isSelected = !pending && workspace.id === selected;
          return html`
            <div
              role="tab"
              aria-selected=${isSelected}
              title="${workspaceSummary(workspace)} · ⌘${index + 1}"
              class=${tabClass(isSelected)}
            >
              ${workspaceGlyph(workspace)}
              <span class="min-w-0 flex-1 truncate">${workspace.name}</span>
              ${workspace.running && workspace.running > 1
                ? html`<span class="font-mono text-micro text-action">${workspace.running}</span>`
                : nothing}
              ${closeButton(workspace.name, isSelected)}
            </div>
          `;
        })}
        ${pending
          ? html`
            <div role="tab" aria-selected="true" class=${tabClass(true)}>
              <span class="inline-flex text-action">${icon("plus")}</span>
              <span class="min-w-0 flex-1 truncate">${pending}</span>
              ${closeButton(pending, true)}
            </div>
          `
          : nothing}
        <span class="ml-0.5 shrink-0">${iconButton(
          "plus",
          "New tab (⌘T)",
        )}</span>
      </div>
    `;
  }
}

customElements.define("workspace-tabs", WorkspaceTabsElement);
