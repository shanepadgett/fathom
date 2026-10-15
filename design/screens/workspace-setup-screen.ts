import { html } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import "../components/messages/conversation-pane.ts";
import "../components/navigation/workspace-launcher.ts";
import "../components/setup/workspace-file-preview.ts";
import "../components/setup/workspace-setup.ts";
import "../components/workspace/workspace-header.ts";
import "../components/workspace/workspace-status-bar.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import { setupMessages } from "../fixtures/workspace-messages.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import {
  harbor,
  harborFile,
  harborFolders,
  openWorkspaces,
  recentWorkspaces,
  setupFindings,
} from "../fixtures/workspaces.ts";
import "../layouts/workspace-layout.ts";

/** Static states of a new tab, before it holds a workspace. */
export type WorkspaceSetupScreenState =
  | "launcher"
  | "folders"
  | "detect"
  | "save"
  | "agent";

/** The folders section of the file, which is all step one has decided. */
const foldersOnly = harborFile.split("\n\n").slice(0, 2).join("\n\n");
const fileLines = harborFile.split("\n").length;

export class WorkspaceSetupScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: WorkspaceSetupScreenState;

  constructor() {
    super();
    this.state = "launcher";
  }

  private renderBody() {
    const { state } = this;
    if (state === "launcher") {
      return html`
        <workspace-launcher
          .workspaces=${recentWorkspaces}
          .open=${openWorkspaces.map((workspace) => workspace.id)}
        ></workspace-launcher>
      `;
    }
    if (state === "agent") {
      return html`
        <conversation-pane
          title="Set up a workspace"
          .messages=${setupMessages}
          .changes=${{
            count: 1,
            added: fileLines,
            removed: 0,
            files: [{ path: "harbor.fathom", added: fileLines, removed: 0 }],
          }}
          .model=${scenario.model}
          .reasoning=${scenario.reasoning}
        ></conversation-pane>
        <workspace-file-preview
          path=${harbor.file ?? ""}
          .text=${harborFile}
          status="Draft · not saved"
        ></workspace-file-preview>
      `;
    }
    return html`
      <workspace-setup
        step=${state}
        name=${harbor.name}
        .folders=${harborFolders}
        .findings=${setupFindings}
      ></workspace-setup>
      <workspace-file-preview
        path=${state === "save" ? harbor.file ?? "" : "harbor.fathom"}
        .text=${state === "folders" ? foldersOnly : harborFile}
        status=${state === "save" ? "Ready to save" : "Draft"}
      ></workspace-file-preview>
    `;
  }

  override render() {
    const { state } = this;
    return html`
      <div class="workspace-shell">
        <workspace-layout>
          <workspace-header
            .tabs=${openWorkspaces}
            pendingTab=${state === "launcher" ? "New tab" : "New workspace"}
          ></workspace-header>
          <div class="workspace-body">${this.renderBody()}</div>
          <workspace-status-bar
            .system=${systemStatus}
            .context=${state === "agent" ? scenario.context : undefined}
          ></workspace-status-bar>
        </workspace-layout>
      </div>
    `;
  }
}

customElements.define("workspace-setup-screen", WorkspaceSetupScreen);
