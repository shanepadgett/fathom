import type { ContextUsage } from "../models/context-usage.ts";

export const contextUsage: ContextUsage = {
  value: 96,
  maximum: 200,
  segments: [
    { kind: "system", label: "System prompt", value: 6 },
    { kind: "tools", label: "Tool definitions", value: 10 },
    { kind: "user", label: "User messages", value: 12 },
    { kind: "assistant", label: "Assistant messages", value: 24 },
    { kind: "calls", label: "Tool calls", value: 8 },
    { kind: "results", label: "Tool results", value: 36 },
  ],
};
