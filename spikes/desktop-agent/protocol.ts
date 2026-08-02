import type { AgentMessage } from "@earendil-works/pi-agent-core";

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface StoredMessage {
  id: string;
  role: string;
  status: "streaming" | "complete" | "interrupted";
  message: AgentMessage;
}

export interface ExtensionSummary {
  id: string;
  name: string;
  enabled: boolean;
  active: boolean;
  description?: string;
  rendererEntry?: string;
  error?: string;
}

export interface RuntimeSnapshot {
  generation: number;
  workspace: string;
  model: string;
  busy: boolean;
  pendingReload: boolean;
  selectedSessionId: string;
  sessions: SessionSummary[];
  messages: StoredMessage[];
  extensions: ExtensionSummary[];
  commands: { name: string; description: string }[];
  approval?: ApprovalRequest;
  notice?: string;
}

export interface ApprovalRequest {
  id: string;
  toolCallId: string;
  toolName: string;
  title: string;
  detail: string;
}

export type EngineCommand =
  | { type: "prompt"; text: string }
  | { type: "abort" }
  | { type: "create_session" }
  | { type: "select_session"; sessionId: string }
  | { type: "toggle_extension"; extensionId: string; enabled: boolean }
  | { type: "run_command"; name: string; arguments: string }
  | { type: "resolve_approval"; approvalId: string; approved: boolean }
  | { type: "prepare_reload" };

export type RuntimeEvent =
  | { type: "snapshot"; snapshot: RuntimeSnapshot }
  | { type: "message_started" | "message_updated" | "message_finished"; record: StoredMessage }
  | {
    type: "tool_started" | "tool_updated" | "tool_finished";
    toolCallId: string;
    toolName: string;
    args?: unknown;
    result?: unknown;
    isError?: boolean;
  }
  | { type: "approval_required"; approval: ApprovalRequest }
  | { type: "approval_resolved"; approvalId: string }
  | { type: "notice"; level: "info" | "error"; message: string };

export interface EngineInit {
  type: "init";
  generation: number;
  workspace: string;
  dataDir: string;
  model: string;
}

export interface EngineRequest {
  type: "request";
  generation: number;
  requestId: string;
  command: EngineCommand;
}

export type HostToEngine = EngineInit | EngineRequest;

export type EngineToHost =
  | { type: "ready"; generation: number; snapshot: RuntimeSnapshot }
  | { type: "event"; generation: number; event: RuntimeEvent }
  | {
    type: "response";
    generation: number;
    requestId: string;
    ok: boolean;
    value?: unknown;
    error?: string;
  };

export interface RendererState {
  draft: string;
  extensionsOpen: boolean;
}

export interface BootstrapPayload {
  snapshot: RuntimeSnapshot;
  rendererState: RendererState;
}
