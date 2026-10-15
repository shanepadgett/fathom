import type { Workspace, WorkspaceFolder } from "../../models/workspace.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { button } from "../../primitives/button.ts";
import { icon } from "../../primitives/icon.ts";

type CheckoutChoice = "branch" | "current" | "worktree";

const checkoutChoices: {
  id: CheckoutChoice;
  label: string;
  detail: string;
}[] = [
  {
    id: "worktree",
    label: "Separate worktrees",
    detail:
      "Each folder it edits gets its own worktree, so this session can run beside others.",
  },
  {
    id: "branch",
    label: "New branch in your checkouts",
    detail: "Switches every folder it edits to the same new branch.",
  },
  {
    id: "current",
    label: "Current branches",
    detail: "Edits land in your working copies as they are.",
  },
];

const folderRow = (folder: WorkspaceFolder) =>
  html`
    <div class="flex items-center gap-3 px-3 py-2 text-sm">
      <span class=${folder.access === "read"
        ? "text-muted"
        : "text-action"}>${icon(
          folder.access === "read" ? "square" : "check-square",
          "large",
        )}</span>
      <span class="w-20 shrink-0 font-medium">${folder.name}</span>
      <span
        class="min-w-0 flex-1 truncate font-mono text-xs text-muted">${folder
          .path}</span>
      <span class="shrink-0 text-xs ${folder.access === "read"
        ? "text-muted"
        : "text-ink"}">${folder.access === "read"
        ? "Read only"
        : "Can edit"}</span>
    </div>
  `;

/** Starting a session inside a workspace: scope and checkout, not project. */
export class WorkspaceSessionStartElement extends DesignElement {
  static override properties = {
    workspace: { attribute: false },
    checkout: { type: String },
  };

  declare workspace: Workspace;
  declare checkout: CheckoutChoice;

  constructor() {
    super();
    this.checkout = "worktree";
  }

  override render() {
    if (!this.workspace) {
      return nothing;
    }
    const { workspace, checkout } = this;
    return html`
      <section
        role="dialog"
        aria-modal="true"
        aria-label="New session in ${workspace.name}"
        class="w-search-panel overflow-hidden rounded-lg border border-line bg-canvas shadow-md"
      >
        <header class="flex h-12 items-center gap-2 border-b border-line px-5">
          <span class="font-medium">New session</span>
          <span class="text-muted">in ${workspace.name}</span>
        </header>
        <div class="flex flex-col gap-5 p-5">
          <div
            class="min-h-20 rounded-md border border-control-line px-3 py-2.5 text-sm text-muted"
          >
            Describe the change. Mention a folder with @api or @web…
          </div>

          <div>
            <h3
              class="mb-2 text-xs text-muted">Folders this session can edit \\u00b7 it can read all of them</h3>
            <div class="divide-y divide-line rounded-md border border-line">
              ${workspace.folders.map(folderRow)}
            </div>
          </div>

          <div>
            <h3 class="mb-2 text-xs text-muted">Where edits go</h3>
            <div class="grid gap-2">
              ${checkoutChoices.map((choice) =>
                html`
                  <div
                    role="radio"
                    aria-checked=${choice.id === checkout}
                    class="flex gap-3 rounded-md border px-3 py-2.5 ${choice
                        .id === checkout
                      ? "border-action bg-action/5"
                      : "border-line"}"
                  >
                    <span
                      class="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${choice
                          .id === checkout
                        ? "border-action"
                        : "border-control-line"}"
                    >${choice.id === checkout
                      ? html`<span class="h-1.5 w-1.5 rounded-full bg-action"></span>`
                      : nothing}</span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm">${choice.label}</p>
                      <p class="mt-0.5 text-xs text-muted">${choice.detail}</p>
                      ${choice.id === checkout && choice.id !== "current"
                        ? html`
                          <p class="mt-2 flex items-center gap-2 font-mono text-xs">
                            ${icon("git-branch", "small")}fix/resumable-uploads
                            <span class="font-sans text-muted">· named from your first message</span>
                          </p>
                        `
                        : nothing}
                    </div>
                  </div>
                `
              )}
            </div>
          </div>

          <p class="flex items-center gap-2 text-xs text-muted">
            ${icon("terminal-window")}Starts db, api, and web when a check needs
            them. Worktrees get their own ports.
          </p>
        </div>
        <footer
          class="flex items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3"
        >
          ${button({ label: "Cancel", variant: "quiet", size: "compact" })}
          ${button({
            label: "Start session",
            content:
              html`Start session <span class="text-xs opacity-70">⌘↵</span>`,
            variant: "primary",
            size: "compact",
          })}
        </footer>
      </section>
    `;
  }
}

customElements.define("workspace-session-start", WorkspaceSessionStartElement);
