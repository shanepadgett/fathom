import type { ToolSchema } from "./model.ts";
export interface ToolDefinition extends ToolSchema {
  execute(args: Record<string, unknown>, signal: AbortSignal): Promise<string>;
}
export interface ToolRegistry {
  register(tool: ToolDefinition): () => void;
  list(): ToolDefinition[];
  execute(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<string>;
}
export interface WorkspaceService {
  root: string;
  resolve(path: string): string;
}
