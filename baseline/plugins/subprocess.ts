/** Bounded Deno.Command. bash and script tools inject this instead of spawning themselves. */
import type { PluginContext } from "../sdk.ts";

import { Service } from "cordis";

export interface SubprocessRun {
  command: string;
  args: string[];
  cwd: string;
  signal: AbortSignal;
  timeoutMs: number;
}

declare module "../sdk.ts" {
  interface Services {
    subprocess: Subprocess;
  }
}

export default class Subprocess extends Service {
  static provide = "subprocess" as const;

  constructor(ctx: PluginContext<never>) {
    super(ctx, "subprocess");
  }

  async run(input: SubprocessRun) {
    input.signal.throwIfAborted();
    const child = new Deno.Command(input.command, {
      args: input.args,
      cwd: input.cwd,
      stdout: "piped",
      stderr: "piped",
      stdin: "null",
    }).spawn();
    const timer = setTimeout(() => child.kill("SIGTERM"), input.timeoutMs);
    const abort = () => child.kill("SIGTERM");
    input.signal.addEventListener("abort", abort, { once: true });
    try {
      const output = await child.output();
      const text =
        new TextDecoder().decode(output.stdout) + new TextDecoder().decode(output.stderr);
      return { text, code: output.code ?? 1 };
    } finally {
      clearTimeout(timer);
      input.signal.removeEventListener("abort", abort);
    }
  }
}
