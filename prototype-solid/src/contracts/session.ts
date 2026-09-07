import type { ModelMessage } from "./model.ts";
export type RunStatus = "idle" | "running" | "error" | "cancelled";
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  text: string;
  toolName?: string;
  isError?: boolean;
  args?: Record<string, unknown>;
}
export interface SessionSnapshot {
  id: string;
  status: RunStatus;
  messages: DisplayMessage[];
  events: HarnessEvent[];
}
export type HarnessEvent =
  | { type: "snapshot"; session: SessionSnapshot }
  | { type: "delta"; text: string }
  | { type: "status"; status: RunStatus }
  | { type: "tool-start"; name: string; args: Record<string, unknown> }
  | { type: "error"; message: string };
export interface SessionService {
  history: ModelMessage[];
  snapshot(): SessionSnapshot;
  append(message: Omit<DisplayMessage, "id">): void;
  status(status: RunStatus): void;
  reset(): void;
  publish(event: HarnessEvent): void;
  subscribe(listener: (event: HarnessEvent) => void): () => void;
}
export interface RuntimeService {
  readonly id: string;
  run(text: string, signal: AbortSignal): Promise<void>;
}
