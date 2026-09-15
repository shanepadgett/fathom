import type { GitStatus } from "../components/editor/change-status.ts";
import type { IconName } from "../primitives/icon.ts";

export interface FileNode {
  id: string;
  name: string;
  icon?: IconName;
  status?: GitStatus;
  children?: FileNode[];
}

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export interface Changes {
  files?: FileChange[];
  count: number;
  added: number;
  removed: number;
}
