import { scenario } from "../fixtures/workspace-scenario.ts";
import { codeLines, diffLines } from "../fixtures/code.ts";
import {
  changeStatus,
  diffStat,
  meter,
  shortcutHint,
  statusDot,
} from "../primitives/content.ts";
import {
  button,
  iconButton,
  selectorButton,
  tabStrip,
} from "../primitives/controls.ts";
import { composer, message, toolActivity } from "./conversation.ts";
import { changedFilesList, fileTree } from "./files.ts";
import { editorPane } from "./editor.ts";
import { sessionInspector } from "./inspector.ts";
import { diffPane } from "./review.ts";
import { chatListItem, sessionSidebar } from "./sessions.ts";
import { chatSearch, projectPicker } from "./search.ts";
import { workspaceHeader, workspaceStatusBar } from "./workspace-chrome.ts";
const example = (name: string, markup: string) => ({ name, markup });
const longChat = {
  ...scenario.chats[0],
  title:
    "Investigate synchronization between multiple workspace windows after renaming a very long session title",
  branch: "feature/synchronize-session-titles-across-workspaces",
};
export const primitiveEntries = [
  {
    id: "workspace-controls",
    name: "Compact controls",
    description:
      "Static button, icon button, selector, and tab appearances using the shared button system.",
    examples: [
      example(
        "Controls",
        `<div class="flex flex-wrap items-center gap-3">${
          button({ label: "Action" })
        }${iconButton("note-pencil", "New chat")}${
          selectorButton("Claude Sonnet", "Medium")
        }${button({ label: "Unavailable", disabled: true })}</div>`,
      ),
      example(
        "Tabs",
        tabStrip(
          [{ id: "files", label: "Files" }, {
            id: "changes",
            label: "Changes",
          }],
          "files",
          "Workspace section",
        ),
      ),
    ],
  },
  {
    id: "status-and-usage",
    name: "Status and usage",
    description: "Git states, run indicators, token usage, and keyboard hints.",
    examples: [
      example(
        "Changes",
        `<div class="flex items-center gap-3">${
          (["A", "M", "D", "R", "?"] as const).map(changeStatus).join("")
        }${diffStat(24, 8)}${statusDot("action", "Reviewing changes")}</div>`,
      ),
      example(
        "Usage",
        `<div class="flex gap-4">${meter(48, 200, "Context usage")}${
          meter(195, 200, "Context near capacity")
        }</div>`,
      ),
      example("Shortcut", shortcutHint(["Enter"], "Select")),
    ],
  },
];
export const compositeEntries = [
  {
    id: "chat-navigation",
    name: "Chat navigation",
    description:
      "Shared project and branch identities with compact, single-line chat titles.",
    examples: [
      example(
        "Sidebar",
        `<div class="w-sidebar bg-surface">${
          sessionSidebar(
            scenario.chats,
            scenario.projects,
            scenario.selectedChat.id,
          )
        }</div>`,
      ),
      example(
        "Long title",
        `<div class="w-sidebar bg-surface">${
          chatListItem(longChat, scenario.projects[0], true)
        }${chatListItem(longChat, scenario.projects[0])}</div>`,
      ),
    ],
  },
  {
    id: "search-surfaces",
    name: "Search surfaces",
    description:
      "Static project and chat search share the surface, search line, and keyboard footer.",
    examples: [
      example("Projects", projectPicker(scenario.projects)),
      example("Chats", chatSearch(scenario.searchChats, scenario.projects)),
      example("Empty results", chatSearch([], scenario.projects)),
    ],
  },
  {
    id: "file-navigation",
    name: "File navigation",
    description:
      "Dense file rows are shared by the tree and Changes list. Expansion is a supplied preview state.",
    examples: [
      example(
        "Tree",
        `<div class="w-files-sidebar bg-surface">${
          fileTree(
            scenario.files,
            scenario.selectedFile,
            scenario.expandedFolders,
          )
        }</div>`,
      ),
      example(
        "Changes",
        `<div class="w-files-sidebar bg-surface">${
          changedFilesList(
            scenario.changedFiles,
            scenario.selectedFile,
            scenario.changes,
          )
        }</div>`,
      ),
    ],
  },
  {
    id: "conversation-content",
    name: "Conversation content",
    description:
      "Messages compose authored prose, tool activity, change summaries, and run status.",
    examples: [
      example("Message", message(scenario.messages[1], scenario.changes)),
      example(
        "Tool activity",
        toolActivity(
          "Read 3 files",
          "0.8s",
          scenario.changedFiles.map((file) => file.name),
        ),
      ),
    ],
  },
  {
    id: "composer",
    name: "Composer",
    description:
      "Floating composer surface with shared compact controls; no application actions.",
    examples: [
      example("Standard", composer(scenario.model, scenario.reasoning)),
      example(
        "Narrow",
        `<div class="w-files-sidebar">${
          composer(scenario.model, scenario.reasoning)
        }</div>`,
      ),
    ],
  },
  {
    id: "editor-pane",
    name: "Editor pane",
    description:
      "File tabs, compact breadcrumbs, static code, and editor status.",
    examples: [
      example(
        "Editor",
        `<div class="flex h-workspace-preview">${
          editorPane(
            [scenario.changedFiles[0], scenario.changedFiles[2]],
            scenario.selectedFile,
            scenario.path,
            codeLines,
          )
        }</div>`,
      ),
    ],
  },
  {
    id: "diff-pane",
    name: "Diff pane",
    description:
      "Shared breadcrumb and change statistics with static diff lines.",
    examples: [
      example(
        "File diff",
        diffPane(scenario.path, diffLines, scenario.changes.count, 12, 4),
      ),
    ],
  },
  {
    id: "session-inspector",
    name: "Session inspector",
    description: "Sections and metric lists for session information.",
    examples: [
      example(
        "Inspector",
        `<div class="w-sidebar bg-surface">${
          sessionInspector(scenario.inspector)
        }</div>`,
      ),
    ],
  },
  {
    id: "workspace-chrome",
    name: "Workspace chrome",
    description: "Header and footer shared across both workspace layouts.",
    examples: [
      example("Header", workspaceHeader("agent")),
      example(
        "Footer",
        workspaceStatusBar(
          "Reviewing changes",
          scenario.changes.count,
          scenario.context,
        ),
      ),
    ],
  },
];
