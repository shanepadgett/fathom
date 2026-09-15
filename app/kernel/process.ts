import type { ChildProcess } from "node:child_process";

import { spawn } from "node:child_process";
import process from "node:process";

/** Children must be spawned detached on Unix to own their process group. */
export function signalProcessGroup(
  child: ChildProcess,
  signal: NodeJS.Signals,
): void {
  try {
    if (!child.pid) return;
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

export async function captureProcess(command: string, args: string[], options: {
  cwd: string;
  env?: Record<string, string>;
  input?: string;
  signal: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  options.signal.throwIfAborted();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxBytes = options.maxBytes ?? 64_000_000;
  let bytes = 0;
  let failure: Error | undefined;
  let escalation: ReturnType<typeof setTimeout> | undefined;
  const stdout: Buffer[] = [], stderr: Buffer[] = [];
  const stop = (error: Error) => {
    if (failure) return;
    failure = error;
    signalProcessGroup(child, "SIGTERM");
    escalation = setTimeout(() => signalProcessGroup(child, "SIGKILL"), 1000);
  };
  const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) {
      stop(new Error(`${command} output exceeded ${maxBytes} bytes.`));
    } else chunks.push(chunk);
  };
  child.stdout.on("data", collect(stdout));
  child.stderr.on("data", collect(stderr));
  child.stdin.on("error", (error) => stop(error));
  const closed = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 137));
  });
  const abort = () => stop(new Error(`${command} cancelled.`));
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const timer = setTimeout(
    () =>
      stop(
        new Error(`${command} timed out after ${timeoutMs / 1000} seconds.`),
      ),
    timeoutMs,
  );
  try {
    child.stdin.end(options.input ?? "");
    const code = await closed;
    if (failure) throw failure;
    return {
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    };
  } finally {
    clearTimeout(timer);
    clearTimeout(escalation);
    options.signal.removeEventListener("abort", abort);
    if (failure) signalProcessGroup(child, "SIGKILL");
  }
}
