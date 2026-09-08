import type { Focus } from "./focus-switch.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { drawerControl } from "../primitives/drawer-control.ts";
import { iconButton } from "../primitives/icon-button.ts";
import "../primitives/fathom-wordmark.ts";
import "./focus-switch.ts";

export class WorkspaceHeaderElement extends DesignElement {
  static override properties = { mode: { type: String } };
  declare mode: Focus;

  constructor() {
    super();
    this.mode = "agent";
  }

  override render() {
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
          ${mode === "chat" ? nothing : drawerControl(mode === "editor" ? "agent" : "diff")}
        </div>
      </header>
    `;
  }
}

customElements.define("workspace-header", WorkspaceHeaderElement);
