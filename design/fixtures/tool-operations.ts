import type { ToolOperation } from "../models/conversation.ts";

export const toolOperations: ToolOperation[] = [
  { action: "read", files: ["session-store.ts", "session-sidebar.ts", "conversation-header.ts"] },
  { action: "edited", files: ["session-store.ts", "session-sidebar.ts"] },
  { action: "written", files: ["session-rename.test.ts", "session-selection.test.ts"] },
];
