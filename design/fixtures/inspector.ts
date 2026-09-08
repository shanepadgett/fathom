import type { InspectorData } from "../models/inspector.ts";

export const inspector: InspectorData = {
  usage: [
    ["Session cost", "$0.18"],
    ["Run time", "24s"],
    ["Output", "68 tok/s"],
    ["Cache hit", "86%"],
  ],
  tokens: [
    ["Input", "12,480"],
    ["Output", "1,620"],
    ["Cache read", "35,200"],
  ],
  servers: ["TypeScript", "CSS"],
  environment: "Local workspace",
  environmentDetail: "2 tools running · 4 plugins",
};
