import type { AssistantMessage, Context as ModelContext, Message } from "@earendil-works/pi-ai";

import type { ToolContext } from "./services.ts";
import type { EntryAttachment } from "./session.ts";

export interface StepContinuation {
  action: "continue";
  prompt: string;
  source?: { pluginId: string; label: string };
}

export interface RunInput {
  sessionId: string;
  text: string;
  attachments?: EntryAttachment[];
  signal: AbortSignal;
  snapshotTreeId?: string;
}
export interface StepInput {
  sessionId: string;
  context: ModelContext;
  signal: AbortSignal;
}
export interface ToolInput extends ToolContext {
  name: string;
  args: Record<string, unknown>;
}
export type ToolDecision =
  | { action: "block"; reason: string }
  | {
      action: "prompt_user";
      explanation: string;
    }
  | { action: "mock"; result: string };

declare module "cordis" {
  interface Events {
    "run:admit"(input: RunInput): void | Promise<void>;
    "run:start"(input: { sessionId: string }): void | Promise<void>;
    "step:before"(
      input: StepInput,
    ): void | { messages: Message[] } | Promise<void | { messages: Message[] }>;
    "step:model"(input: StepInput): void | Promise<void>;
    "tool:before"(input: ToolInput): ToolDecision | void | Promise<ToolDecision | void>;
    "tool:execute"(input: ToolInput): void | Promise<void>;
    "tool:after"(input: ToolInput & { result: string; isError: boolean }): void | Promise<void>;
    "step:after"(input: {
      sessionId: string;
      reply: AssistantMessage;
      signal: AbortSignal;
    }): StepContinuation | void | Promise<StepContinuation | void>;
    "run:finish"(input: { sessionId: string }): void | Promise<void>;
    "session:idle"(sessionId: string): void | Promise<void>;
    "compaction:before"(input: { sessionId: string; protectedIds: string[] }): void | Promise<void>;
    "compaction:after"(input: {
      sessionId: string;
      summary: string;
      pinnedArtifacts: string[];
    }): void | Promise<void>;
  }
}
