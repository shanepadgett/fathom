import type { WorkspaceFolder, WorkspaceService } from "./workspace.ts";

export interface InspectorData {
  /** Present when the session runs in a workspace with several folders. */
  folders?: WorkspaceFolder[];
  services?: WorkspaceService[];
  usage: [string, string][];
  tokens: [string, string][];
  servers?: string[];
}
