import type { ModelMessage, ToolSchema } from "./model.ts";
export interface ContextService {
  build(input: { messages: ModelMessage[]; tools: ToolSchema[] }): {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
  };
}
