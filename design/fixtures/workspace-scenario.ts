import type { WorkspaceScenario } from "../models/workspace-scenario.ts";

import { contextUsage } from "./context-usage.ts";
import { changedFiles, files } from "./files.ts";
import { inspector } from "./inspector.ts";
import { messages } from "./messages.ts";
import { chats, projects } from "./sessions.ts";

export const scenario: WorkspaceScenario = {
  projects,
  chats,
  files,
  changedFiles,
  messages,
  inspector,
  selectedChat: chats[0],
  selectedFile: "store",
  expandedFolders: ["root", "src", "sessions", "tests"],
  searchChats: [chats[0], chats[1], chats[4]],
  changes: { count: changedFiles.length, added: 24, removed: 8, files: [
    { path: "src/sessions/session-store.ts", added: 12, removed: 4 },
    { path: "src/sessions/session-list.ts", added: 4, removed: 4 },
    { path: "tests/session.test.ts", added: 8, removed: 0 },
  ] },
  selectedDiff: { added: 12, removed: 4 },
  context: contextUsage,
  model: "Claude Sonnet",
  reasoning: "Medium",
  path: ["src", "sessions", "session-store.ts"],
};
