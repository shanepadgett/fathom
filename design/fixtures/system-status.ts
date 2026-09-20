import type { SystemStatus } from "../models/system-status.ts";

/** App-wide activity, independent of the selected conversation or focus. */
export const systemStatus: SystemStatus = {
  runningAgents: 3,
};
