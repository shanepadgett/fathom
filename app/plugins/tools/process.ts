import type { Readable } from "node:stream";

import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";

import { signalProcessGroup } from "../../kernel/process.ts";
import { workspaceEnvironment } from "../../kernel/runtime.ts";

interface ProcessInput {
  command: string;
  args: string[];
  cwd: string;
  signal: AbortSignal;
  timeoutMs: number;
  logPath: string;
  env?: Record<string, string>;
  report(text: string): void;
}

export async function runProcess(input: ProcessInput) {
  input.signal.throwIfAborted();
  await mkdir(dirname(input.logPath), { recursive: true, mode: 0o700 });
  const log = await open(input.logPath, "w", 0o600);
  const child = await (async () => {
    try {
      input.signal.throwIfAborted();
      return spawn(input.command, input.args, {
        cwd: input.cwd,
        env: { ...workspaceEnvironment(), ...input.env },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      await log.close();
      throw error;
    }
  })();
  let count = 0, head = "", tail = "", timedOut = false;
  let writes = Promise.resolve();
  let escalation: ReturnType<typeof setTimeout> | undefined;
  const kill = (signal: NodeJS.Signals) => signalProcessGroup(child, signal);
  const terminate = () => {
    if (escalation) return;
    kill("SIGTERM");
    escalation = setTimeout(() => kill("SIGKILL"), 1000);
  };
  const read = async (stream: Readable) => {
    stream.setEncoding("utf8");
    for await (const chunk of stream) {
      const text = String(chunk);
      count += Buffer.byteLength(text);
      writes = writes.then(async () => {
        await log.write(text);
      });
      await writes;
      head += text.slice(0, Math.max(0, 50_000 - head.length));
      tail = (tail + text).slice(-50_000);
      input.report(text.slice(0, 8000));
    }
  };
  const exited = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 137));
  });
  input.signal.addEventListener("abort", terminate, { once: true });
  if (input.signal.aborted) terminate();
  const timer = setTimeout(() => {
    timedOut = true;
    terminate();
  }, input.timeoutMs);
  const readers = [read(child.stdout), read(child.stderr)];
  try {
    const [code] = await Promise.all([exited, ...readers]);
    const preview = count <= 50_000
      ? head
      : `${
        head.split("\n").slice(0, 50).join("\n")
      }\n[Full output: ${count} bytes saved to ${input.logPath}]\n${
        tail.split("\n").slice(-50).join("\n")
      }`;
    return `exit=${code}${timedOut ? " (timeout)" : ""}\n${preview}`;
  } catch (error) {
    kill("SIGKILL");
    child.stdout.destroy();
    child.stderr.destroy();
    await Promise.allSettled(readers);
    throw error;
  } finally {
    clearTimeout(timer);
    clearTimeout(escalation);
    input.signal.removeEventListener("abort", terminate);
    if (input.signal.aborted || timedOut) kill("SIGKILL");
    try {
      await writes;
    } finally {
      await log.close();
    }
  }
}
