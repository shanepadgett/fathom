export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface Chat {
  id: string;
  title: string;
  projectId?: string;
  /** Workspace folders the session has changed, by folder name. */
  folders?: string[];
  branch?: string;
  time: string;
  status?: string;
  activity?: "running" | "completed" | "attention";
  unread?: boolean;
}
