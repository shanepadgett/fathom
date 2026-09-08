import type { IconName } from "../primitives/icon.ts";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: IconName;
  agentAction?: boolean;
}

export type ContextMenuSection = ContextMenuItem[];
