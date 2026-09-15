export interface ToolExecution {
  id: string;
  name: string;
  target: string;
  action?: "read" | "edited" | "written";
  state: "running" | "completed" | "error";
  arguments: string;
  result: string;
  duration: string;
}

export interface ToolBatch {
  state: "running" | "thinking" | "completed";
  tools: ToolExecution[];
}
