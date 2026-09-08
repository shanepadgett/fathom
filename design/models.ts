import type { GitStatus, IconName, Tone } from "./primitives/content.ts";
export interface Project {
  id: string;
  name: string;
  path: string;
}
export interface Chat {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  time: string;
  status?: string;
}
export interface FileNode {
  id: string;
  name: string;
  icon?: IconName;
  status?: GitStatus;
  children?: FileNode[];
}
export type MessageBlock =
  | { kind: "prose"; text: string }
  | { kind: "tool"; label: string; duration: string; files: string[] }
  | { kind: "changes"; description: string }
  | { kind: "status"; text: string; tone: Tone };
export interface Message {
  author: string;
  time: string;
  agent?: boolean;
  blocks: MessageBlock[];
}
export interface InspectorData {
  usage: [string, string][];
  tokens: [string, string][];
  servers: string[];
  environment: string;
  environmentDetail: string;
}

export interface Changes {
  count: number;
  added: number;
  removed: number;
}
export interface DiffLine {
  kind: "context" | "added" | "removed";
  text: string;
}
export interface CodeLine {
  markup: string;
  added?: boolean;
}
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
  context: { value: number; maximum: number };
  model: string;
  reasoning: string;
  path: string[];
  selectedDiff: { added: number; removed: number };
}
