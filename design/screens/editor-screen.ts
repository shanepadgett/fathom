import { html, nothing } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import { codeLines } from "../fixtures/code.ts";
import "../components/messages/conversation-pane.ts";
import "../components/editor/editor-pane.ts";
import "../components/navigation/files-sidebar.ts";
import "../components/workspace/workspace-header.ts";
import "../components/workspace/workspace-status-bar.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "../layouts/workspace-drawer.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-sidebar.ts";

export type EditorScreenState = "files" | "changes" | "agent";

export class EditorScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: EditorScreenState;

  constructor() {
    super();
    this.state = "files";
  }

  override render() {
    return html`
      <div class="workspace-shell">
        <workspace-layout>
          <workspace-header mode="editor"></workspace-header>

          <div class="workspace-body">
            <workspace-sidebar placement="files" role="complementary" aria-label="Workspace files">
              <files-sidebar
                .nodes=${scenario.files}
                .changed=${scenario.changedFiles}
                .selected=${scenario.selectedFile}
                .expanded=${scenario.expandedFolders}
                .changes=${scenario.changes}
                .view=${this.state === "changes" ? "changes" : "files"}
              ></files-sidebar>
            </workspace-sidebar>

            <editor-pane
              .files=${[scenario.changedFiles[0], scenario.changedFiles[2]]}
              .selected=${scenario.selectedFile}
              .path=${scenario.path}
              .lines=${codeLines}
            ></editor-pane>
          </div>

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
          ></workspace-status-bar>

          ${this.state === "agent"
            ? html`
              <div class="workspace-scrim">
                <workspace-drawer kind="conversation" role="region"
                  aria-label="Agent overlay">
                  <conversation-pane
                    .title=${scenario.selectedChat.title}
                    .messages=${scenario.messages}
                    .changes=${scenario.changes}
                    .model=${scenario.model}
                    .reasoning=${scenario.reasoning}
                    presentation="drawer"
                  ></conversation-pane>
                </workspace-drawer>
              </div>
            `
            : nothing}
        </workspace-layout>
      </div>
    `;
  }
}

customElements.define("editor-screen", EditorScreen);
