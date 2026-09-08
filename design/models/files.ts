import type { GitStatus } from "../primitives/change-status.ts";
import type { IconName } from "../primitives/icon.ts";

export interface FileNode {
  id: string;
  name: string;
  icon?: IconName;
  status?: GitStatus;
  children?: FileNode[];
}

export interface Changes {
  count: number;
  added: number;
  removed: number;
}
