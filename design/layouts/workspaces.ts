import type { CodeLine, DiffLine } from "../models.ts";
import type { WorkspaceScenario } from "../models.ts";
import { conversationPane } from "../composites/conversation.ts";
import { filesSidebar } from "../composites/files.ts";
import { sessionSidebar } from "../composites/sessions.ts";
import { sessionInspector } from "../composites/inspector.ts";
import { editorPane } from "../composites/editor.ts";
import { diffPane } from "../composites/review.ts";
import { chatSearch, projectPicker } from "../composites/search.ts";
import {
  workspaceHeader,
  workspaceStatusBar,
} from "../composites/workspace-chrome.ts";
import {
  sidebarPane,
  workspaceDrawer,
  workspaceOverlay,
  workspaceShell,
} from "./workspace-shell.ts";
export type AgentState =
  | "base"
  | "no-session"
  | "diff"
  | "projects"
  | "chat-search";
export type EditorState = "files" | "changes" | "agent";
const conversation = (data: WorkspaceScenario, drawer = false) =>
  conversationPane(
    data.selectedChat.title,
    data.messages,
    data.changes,
    data.model,
    data.reasoning,
    drawer ? "drawer" : "main",
  );
export const agentWorkspace = (
  data: WorkspaceScenario,
  state: AgentState,
  diff: DiffLine[],
) =>
  workspaceShell({
    header: workspaceHeader("agent"),
    leading: sidebarPane(
      sessionSidebar(data.chats, data.projects, data.selectedChat.id),
      "Project sessions",
      "chats",
    ),
    primary: conversation(data),
    trailing: state === "no-session" ? "" : sidebarPane(
      sessionInspector(data.inspector),
      "Session inspector",
      "inspector",
    ),
    footer: workspaceStatusBar(
      data.selectedChat.status ?? "Idle",
      data.changes.count,
      data.context,
    ),
    drawer: state === "diff"
      ? workspaceDrawer(
        diffPane(
          data.path,
          diff,
          data.changes.count,
          data.selectedDiff.added,
          data.selectedDiff.removed,
          true,
        ),
        "diff",
      )
      : "",
    overlay: state === "projects"
      ? workspaceOverlay(projectPicker(data.projects), "Project picker overlay")
      : state === "chat-search"
      ? workspaceOverlay(
        chatSearch(data.searchChats, data.projects),
        "Chat search overlay",
      )
      : "",
  });
export const editorWorkspace = (
  data: WorkspaceScenario,
  state: EditorState,
  code: CodeLine[],
) =>
  workspaceShell({
    header: workspaceHeader("editor"),
    leading: sidebarPane(
      filesSidebar(
        data.files,
        data.changedFiles,
        data.selectedFile,
        data.expandedFolders,
        data.changes,
        state === "changes" ? "changes" : "files",
      ),
      "Workspace files",
      "files",
    ),
    primary: editorPane(
      [data.changedFiles[0], data.changedFiles[2]],
      data.selectedFile,
      data.path,
      code,
    ),
    footer: workspaceStatusBar(
      data.selectedChat.status ?? "Idle",
      data.changes.count,
      data.context,
    ),
    drawer: state === "agent"
      ? workspaceDrawer(conversation(data, true), "conversation")
      : "",
  });
