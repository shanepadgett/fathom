/** Third-party service. Provides ctx.logbook on top of fs. Other plugins inject this, not disk. */
import type { PluginContext } from "../sdk.ts";

import { Service } from "cordis";

declare module "../sdk.ts" {
  interface Services {
    logbook: Logbook;
  }
}

export default class Logbook extends Service {
  static inject = ["fs"] as const;
  static provide = "logbook" as const;
  declare ctx: PluginContext<"fs">;

  constructor(ctx: PluginContext<"fs">) {
    super(ctx, "logbook");
  }

  async read() {
    if (!(await this.ctx.fs.exists("LOGBOOK.md"))) return "";
    return this.ctx.fs.readText("LOGBOOK.md");
  }

  async append(line: string) {
    const stamp = new Date().toISOString();
    const prev = await this.read();
    const body = prev && !prev.endsWith("\n") ? `${prev}\n` : prev;
    await this.ctx.fs.replace("LOGBOOK.md", `${body}- ${stamp} ${line.trim()}\n`);
  }
}
