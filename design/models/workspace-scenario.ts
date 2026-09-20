import type { ContextUsage } from "./context-usage.ts";
import type { Message } from "./conversation.ts";
import type { Changes, FileNode } from "./files.ts";
import type { InspectorData } from "./inspector.ts";
import type { Chat, Project } from "./session.ts";

export interface WorkspaceScenario {
  projects: Project[];
  chats: Chat[];
  files: FileNode[];
  changedFiles: FileNode[];
  messages: Message[];
  inspector: InspectorData;
  selectedChat: Chat;
  selectedFile: string;
  expandedFolders: string[];
  searchChats: Chat[];
  changes: Changes;
  context: ContextUsage;
  model: string;
  reasoning: string;
  path: string[];
  selectedDiff: { added: number; removed: number };
}
