import type { WorkspaceScenario } from "../models/workspace-scenario.ts";

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
  changes: { count: changedFiles.length, added: 24, removed: 8 },
  selectedDiff: { added: 12, removed: 4 },
  context: { value: 48, maximum: 200 },
  model: "Claude Sonnet",
  reasoning: "Medium",
  path: ["src", "sessions", "session-store.ts"],
};
