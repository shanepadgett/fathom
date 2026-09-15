import type { ToolBatch, ToolExecution } from "../models/tool-execution.ts";

const read: ToolExecution = {
  id: "read-store",
  name: "Read file",
  action: "read",
  target: "src/sessions/session-store.ts",
  state: "completed",
  arguments:
    '{ "path": "src/sessions/session-store.ts", "offset": 1, "limit": 80 }',
  result: Array.from(
    { length: 45 },
    (_, i) =>
      `${i + 1}  ${
        [
          "export function renameSession(id, title) {",
          "  const session = sessions.get(id);",
          "  session.title = title;",
          "  notifySubscribers(session);",
          "}",
        ][i % 5]
      }`,
  ).join("\n"),
  duration: "0.8s",
};
const edit: ToolExecution = {
  id: "edit-store",
  name: "Edit file",
  action: "edited",
  target: "src/sessions/session-store.ts",
  state: "completed",
  arguments:
    '{ "path": "src/sessions/session-store.ts", "operation": "update shared title" }',
  result: "Updated the session record.\n+12 lines\n−4 lines",
  duration: "0.3s",
};
export const completedToolBatch: ToolBatch = {
  state: "completed",
  tools: [read],
};
export const toolExecutionFrames: ToolBatch[] = [
  { state: "running", tools: [{ ...edit, state: "running", result: "" }] },
  { state: "running", tools: [edit] },
  { state: "thinking", tools: [edit] },
  {
    state: "running",
    tools: [edit, {
      id: "test",
      name: "Run command",
      target: "deno test tests/session.test.ts",
      state: "running",
      arguments: '{ "command": "deno test tests/session.test.ts" }',
      result: "Checking tests/session.test.ts…\nRunning 3 tests…",
      duration: "",
    }],
  },
  {
    state: "completed",
    tools: [edit, {
      id: "test",
      name: "Run command",
      target: "deno test tests/session.test.ts",
      state: "completed",
      arguments: '{ "command": "deno test tests/session.test.ts" }',
      result: "3 passed · 0 failed",
      duration: "1.2s",
    }],
  },
];
