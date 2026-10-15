/**
 * A workspace is a named set of folders that agents work across together.
 * One folder opened on its own is a workspace with one folder.
 */
export interface WorkspaceFolder {
  /** Short name used in paths, mentions, and filters, such as `api`. */
  name: string;
  path: string;
  branch?: string;
  /** What Fathom detected in the folder, such as `Phoenix · Elixir`. */
  stack?: string;
  access?: "write" | "read";
  changes?: { added: number; removed: number };
}

type WorkspaceActivity = "running" | "attention" | "idle";

export interface Workspace {
  id: string;
  name: string;
  folders: WorkspaceFolder[];
  /** Saved workspace file. Unsaved workspaces have no file yet. */
  file?: string;
  activity?: WorkspaceActivity;
  running?: number;
  opened?: string;
}

export type ServiceState = "running" | "starting" | "stopped" | "failed";

export interface WorkspaceService {
  name: string;
  folder: string;
  command: string;
  port?: number;
  state: ServiceState;
  /** Values this service receives from other services. */
  connects?: string;
}

/** One proposal from reading the folders during setup. */
export interface SetupFinding {
  kind: "service" | "check" | "link" | "instructions";
  title: string;
  detail: string;
  source: string;
  accepted: boolean;
}
