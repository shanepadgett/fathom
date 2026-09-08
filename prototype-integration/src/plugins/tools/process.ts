import type { Readable } from "node:stream";

import { spawn } from "node:child_process";
import process from "node:process";
async function capture(stream: Readable): Promise<string> {
  let text = "";
  let truncated = false;
  stream.setEncoding("utf8");
  for await (const chunk of stream) {
    if (text.length + chunk.length > 32_000) truncated = true;
    text += chunk.slice(0, Math.max(0, 32_000 - text.length));
  }
  return text + (truncated ? "\n[output truncated]" : "");
}
/** A fresh process group lets cancellation close children that hold output pipes. */
export async function runBash(
  command: string,
  cwd: string,
  signal: AbortSignal,
  timeoutMs = 60_000,
) {
  return await runProcess("/bin/bash", ["-c", command], cwd, signal, timeoutMs);
}
export async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  timeoutMs = 60_000,
) {
  signal.throwIfAborted();
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let timedOut = false;
  const kill = () => {
    try {
      if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      /* Process group already exited. */
    }
  };
  const exited = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 137));
  });
  signal.addEventListener("abort", kill, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, timeoutMs);
  try {
    const [code, stdout, stderr] = await Promise.all([
      exited,
      capture(child.stdout),
      capture(child.stderr),
    ]);
    signal.throwIfAborted();
    return `exit=${code}${timedOut ? " (timeout)" : ""}\n${stdout}${
      stderr ? `\nstderr:\n${stderr}` : ""
    }`;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", kill);
  }
}
