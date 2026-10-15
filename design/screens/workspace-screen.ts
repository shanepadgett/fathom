import { html, nothing } from "lit";

import { DesignElement } from "../foundation/design-element.ts";
import "../components/editor/editor-pane.ts";
import "../components/messages/conversation-pane.ts";
import "../components/navigation/session-sidebar.ts";
import "../components/navigation/workspace-file-roots.ts";
import "../components/navigation/workspace-session-start.ts";
import "../components/navigation/workspace-switcher.ts";
import "../components/workspace/session-inspector.ts";
import "../components/workspace/workspace-header.ts";
import "../components/workspace/workspace-rail.ts";
import "../components/workspace/workspace-status-bar.ts";
import { workspaceTitle } from "../components/workspace/workspace-title.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import { harborMessages, resumeCode } from "../fixtures/workspace-messages.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import {
  harbor,
  harborChanges,
  harborExpanded,
  harborFiles,
  harborInspector,
  harborPinned,
  harborSessions,
  openWorkspaces,
  recentWorkspaces,
} from "../fixtures/workspaces.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-sidebar.ts";

/** Static states of one screen, not routes or application state. */
export type WorkspaceScreenState =
  | "tabs"
  | "rail"
  | "switcher"
  | "new-session"
  | "editor";

/** An open multi-folder workspace, with tabs or a rail for the others. */
export class WorkspaceScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: WorkspaceScreenState;

  constructor() {
    super();
    this.state = "tabs";
  }

  override render() {
    const { state } = this;
    const rail = state === "rail";
    const editor = state === "editor";
    const harborFile = harborFiles.find((node) => node.id === "web");
    return html`
      <div class="workspace-shell">
        <workspace-layout>
          <workspace-header
            mode=${editor ? "editor" : "agent"}
            .tabs=${rail ? [] : openWorkspaces}
            selectedTab=${harbor.id}
          ></workspace-header>

          <div class="workspace-body">
            ${rail
              ? html`
                <workspace-rail .workspaces=${openWorkspaces}
                  selected=${harbor.id}></workspace-rail>
              `
              : nothing}
            ${editor
              ? html`
                <workspace-sidebar placement="files" role="complementary"
                  aria-label="Workspace folders">
                  <workspace-file-roots
                    .folders=${harbor.folders}
                    .nodes=${harborFiles}
                    selected="web-resume"
                    .expanded=${harborExpanded}
                  ></workspace-file-roots>
                </workspace-sidebar>

                <editor-pane
                  .files=${harborFile?.children?.[0].children ?? []}
                  selected="web-resume"
                  .path=${["web", "src", "uploads", "resume-upload.ts"]}
                  .lines=${resumeCode}
                ></editor-pane>
              `
              : html`
                <workspace-sidebar placement="chats" role="complementary"
                  aria-label="Workspace sessions">
                  ${rail ? workspaceTitle(harbor) : nothing}
                  <session-sidebar
                    scope="All folders"
                    .pinned=${harborPinned}
                    .chats=${harborSessions}
                    selected="harbor-retry"
                  ></session-sidebar>
                </workspace-sidebar>

                <conversation-pane
                  .title=${harborSessions[0].title}
                  .messages=${harborMessages}
                  .changes=${harborChanges}
                  .model=${scenario.model}
                  .reasoning=${scenario.reasoning}
                ></conversation-pane>

                <workspace-sidebar placement="inspector" role="complementary"
                  aria-label="Session inspector">
                  <session-inspector .data=${harborInspector}></session-inspector>
                </workspace-sidebar>
              `}
          </div>

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
          ></workspace-status-bar>

          ${state === "switcher"
            ? html`
              <div class="workspace-overlay" aria-label="Open workspace overlay">
                <workspace-switcher
                  .workspaces=${recentWorkspaces}
                  .open=${openWorkspaces.map((workspace) => workspace.id)}
                ></workspace-switcher>
              </div>
            `
            : nothing}
          ${state === "new-session"
            ? html`
              <div class="workspace-overlay !pt-12" aria-label="New session overlay">
                <workspace-session-start .workspace=${harbor}></workspace-session-start>
              </div>
            `
            : nothing}
        </workspace-layout>
      </div>
    `;
  }
}

customElements.define("workspace-screen", WorkspaceScreen);
