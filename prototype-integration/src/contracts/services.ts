import type { Workbench } from "../integration/workbench.ts";
import type { ContextService } from "./context.ts";
import type { ModelService } from "./model.ts";
import type { RuntimeService, SessionService } from "./session.ts";
import type { ToolRegistry, WorkspaceService } from "./tools.ts";
export interface Services {
  workbench: Workbench;
  context: ContextService;
  model: ModelService;
  sessions: SessionService;
  runtime: RuntimeService;
  tools: ToolRegistry;
  workspace: WorkspaceService;
}
export type ServiceKey = keyof Services;
