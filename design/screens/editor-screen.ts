import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { codeLines } from "../fixtures/code.ts";
import "../composites/conversation-pane.ts";
import "../composites/editor-pane.ts";
import "../composites/files-sidebar.ts";
import "../composites/workspace-header.ts";
import "../composites/workspace-status-bar.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "../layouts/workspace-body.ts";
import "../layouts/workspace-drawer.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-scrim.ts";
import "../layouts/workspace-shell.ts";
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
      <workspace-shell>
        <workspace-layout>
          <workspace-header mode="editor"></workspace-header>

          <workspace-body>
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
          </workspace-body>

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
          ></workspace-status-bar>

          ${
            this.state === "agent"
              ? html`
                  <workspace-scrim>
                    <workspace-drawer kind="conversation" role="region" aria-label="Agent overlay">
                      <conversation-pane
                        .title=${scenario.selectedChat.title}
                        .messages=${scenario.messages}
                        .changes=${scenario.changes}
                        .model=${scenario.model}
                        .reasoning=${scenario.reasoning}
                        presentation="drawer"
                      ></conversation-pane>
                    </workspace-drawer>
                  </workspace-scrim>
                `
              : nothing
          }
        </workspace-layout>
      </workspace-shell>
    `;
  }
}

customElements.define("editor-screen", EditorScreen);
