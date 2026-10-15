import type { Focus } from "./focus-switch.ts";
import type { Workspace } from "../../models/workspace.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { drawerControl } from "./drawer-control.ts";
import { iconButton } from "../../primitives/icon-button.ts";
import "./fathom-wordmark.ts";
import "./focus-switch.ts";
import "./workspace-tabs.ts";

export class WorkspaceHeaderElement extends DesignElement {
  static override properties = {
    mode: { type: String },
    tabs: { attribute: false },
    selectedTab: { type: String },
    pendingTab: { type: String },
  };
  declare mode: Focus;
  /** Open workspaces. When present, tabs replace the wordmark. */
  declare tabs: Workspace[];
  declare selectedTab: string;
  /** A new tab that has no workspace yet, so it has no focus or drawer. */
  declare pendingTab: string;

  constructor() {
    super();
    this.mode = "agent";
    this.tabs = [];
    this.selectedTab = "";
    this.pendingTab = "";
  }

  private renderTabbed() {
    const { mode, pendingTab } = this;
    return html`
      <header
        class="relative flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface pl-3"
      >
        ${pendingTab ? nothing : iconButton("sidebar-simple", "Close sidebar", {
          sidebarToggle: true,
          toolbar: true,
        })}
        <div class="min-w-0 flex-1">
          <workspace-tabs
            .workspaces=${this.tabs}
            .selected=${this.selectedTab}
            .pending=${pendingTab}
          ></workspace-tabs>
        </div>
        <div class="flex h-full shrink-0 items-center">
          ${pendingTab
            ? nothing
            : html`<focus-switch .mode=${mode}></focus-switch>`}
          <a class="mx-3 flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink" href="./?screen=settings-general" aria-label="Settings" title="Settings">${icon(
            "gear",
            "toolbar",
          )}</a>
          ${pendingTab || mode === "chat"
            ? nothing
            : drawerControl(mode === "editor" ? "agent" : "diff")}
        </div>
      </header>
    `;
  }

  override render() {
    if (this.tabs.length) {
      return this.renderTabbed();
    }
    const { mode } = this;
    return html`
      <header
        class="relative flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4"
      >
        <div class="flex min-w-0 items-center gap-6">
          <fathom-wordmark></fathom-wordmark>${iconButton(
            "sidebar-simple",
            "Close sidebar",
            {
              sidebarToggle: true,
              toolbar: true,
            },
          )}
        </div>
        <div class="absolute left-1/2 -translate-x-1/2">
          <focus-switch .mode=${mode}></focus-switch>
        </div>
        <div class="flex h-full items-center">
          <a class="mx-3 flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink" href="./?screen=settings-general" aria-label="Settings" title="Settings">${icon(
            "gear",
            "toolbar",
          )}</a>
          ${mode === "chat"
            ? nothing
            : drawerControl(mode === "editor" ? "agent" : "diff")}
        </div>
      </header>
    `;
  }
}

customElements.define("workspace-header", WorkspaceHeaderElement);
