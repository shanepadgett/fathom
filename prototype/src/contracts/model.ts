export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
export interface ModelReply {
  text: string;
  calls: ToolCall[];
  stop: "done" | "tools" | "length";
  /** Adapter-owned continuation data; never sent to the UI. */
  continuation?: { adapter: string; value: unknown };
}
export type ModelMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; reply: ModelReply }
  | { role: "tool"; call: ToolCall; text: string; isError: boolean };
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface ModelService {
  readonly info: { provider: string; id: string };
  respond(input: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
    signal: AbortSignal;
    onText(text: string): void;
  }): Promise<ModelReply>;
}
