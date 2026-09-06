import type { ModelService } from "./model.ts";
import type { RuntimeService, SessionService } from "./session.ts";
import type { ToolRegistry, WorkspaceService } from "./tools.ts";
import type { ContextService } from "./context.ts";
export interface Services {
  context: ContextService;
  model: ModelService;
  sessions: SessionService;
  runtime: RuntimeService;
  tools: ToolRegistry;
  workspace: WorkspaceService;
}
export type ServiceKey = keyof Services;
