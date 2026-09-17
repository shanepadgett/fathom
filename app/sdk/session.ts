import type { Message, ModelThinkingLevel, Usage } from "@earendil-works/pi-ai";

export type RunStatus = "idle" | "running" | "retry_waiting" | "approval" | "interrupted" | "error";
export type ToolPolicy = "default" | "read-only" | "no-terminal";

export interface Session {
  id: string;
  title: string;
  parentSessionId: string | null;
  activeLeafId: string | null;
  provider: string;
  model: string;
  thinking: ModelThinkingLevel;
  status: RunStatus;
  pinned: boolean;
  archived: boolean;
  toolPolicy: ToolPolicy;
  createdAt: number;
  updatedAt: number;
}

export interface EntryAttachment {
  type: string;
  data: unknown;
}

export interface Entry {
  id: string;
  sessionId: string;
  parentId: string | null;
  kind: "message" | "custom" | "compaction";
  message?: Message;
  /** Harness-generated input retains user-role context without impersonating the user in the UI. */
  source?: { pluginId: string; label: string };
  attachments?: EntryAttachment[];
  custom?: { type: string; data: unknown };
  status: "pending" | "completed" | "interrupted" | "error";
  snapshotTreeId?: string;
  createdAt: number;
}

export interface ToolExecution {
  id: string;
  sessionId: string;
  entryId: string;
  name: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error" | "aborted";
  result?: string;
  startedAt: number;
  durationMs?: number;
}

export interface SessionState {
  session: Session;
  /** Current in-memory run activity; absent once the run settles. */
  activity?: { label: string; since: number };
  entries: Entry[];
  executions: ToolExecution[];
  queued: {
    id: string;
    text: string;
    mode: "steer" | "follow_up";
    attachments?: EntryAttachment[];
  }[];
}

export interface Attribution {
  pluginId: string;
  purpose: string;
  sessionId?: string;
}

export interface UsageRecord extends Attribution {
  id: string;
  provider: string;
  model: string;
  usage: Usage;
  durationMs: number;
  createdAt: number;
}

export interface Project {
  id: string;
  path: string;
  name: string;
  trusted: boolean;
  /** The user explicitly chose trust or Restricted Mode for this project. */
  trustReviewed?: boolean;
  lastOpenedAt: number;
}

export interface AppEvent {
  type: string;
  projectId?: string;
  sessionId?: string;
  data?: unknown;
}
