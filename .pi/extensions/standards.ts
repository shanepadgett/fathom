import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isAbsolute, relative, resolve } from "node:path";

const MESSAGE_TYPE = "fathom-standards";

const BOUNDARIES = [
  {
    id: "desktop",
    root: "apps/desktop",
    standards: "docs/standards/desktop.md",
  },
  {
    id: "ai",
    root: "packages/ai",
    standards: "docs/standards/ai.md",
  },
  {
    id: "runtime",
    root: "packages/runtime",
    standards: "docs/standards/runtime.md",
  },
] as const;

type Boundary = (typeof BOUNDARIES)[number];

export default function standardsExtension(pi: ExtensionAPI) {
  const pendingReadNudges = new Set<string>();

  pi.on("session_start", () => pendingReadNudges.clear());

  pi.on("tool_result", (event, ctx) => {
    if (event.isError) return;

    const branch = ctx.sessionManager.getBranch();
    for (const boundary of boundariesForTool(event.toolName, event.input, ctx.cwd)) {
      const standardsRead =
        toolReadsPath(event.toolName, event.input, boundary.standards, ctx.cwd) ||
        branchHasStandardsRead(branch, boundary, ctx.cwd);
      if (standardsRead) continue;

      if (event.toolName === "write" || event.toolName === "edit" || event.toolName === "patch") {
        sendWriteNudge(pi, boundary);
        continue;
      }

      if (event.toolName !== "read" || branchHasReadNudge(branch, boundary)) continue;

      const branchKey = `${ctx.sessionManager.getLeafId() ?? "root"}:${boundary.id}`;
      if (pendingReadNudges.has(branchKey)) continue;
      pendingReadNudges.add(branchKey);
      sendReadNudge(pi, boundary);
    }
  });
}

function boundariesForTool(toolName: string, input: unknown, cwd: string): Boundary[] {
  const paths = toolName === "patch" ? patchPaths(input) : [toolPath(input)];
  if (toolName !== "read" && toolName !== "write" && toolName !== "edit" && toolName !== "patch") {
    return [];
  }
  return BOUNDARIES.filter((boundary) =>
    paths.some((path) => path && pathIsWithin(path, boundary.root, cwd))
  );
}

function branchHasStandardsRead(
  branch: readonly unknown[],
  boundary: Boundary,
  cwd: string,
): boolean {
  const successfulReads = new Set<string>();

  for (const entry of branch) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as {
      type?: string;
      message?: {
        role?: string;
        toolCallId?: string;
        toolName?: string;
        isError?: boolean;
        content?: unknown;
      };
    };
    if (
      candidate.type === "message" && candidate.message?.role === "toolResult" &&
      candidate.message.toolName === "read" && !candidate.message.isError &&
      candidate.message.toolCallId
    ) {
      successfulReads.add(candidate.message.toolCallId);
    }
  }

  for (const entry of branch) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as {
      type?: string;
      message?: { role?: string; content?: unknown };
    };
    if (
      candidate.type !== "message" || candidate.message?.role !== "assistant" ||
      !Array.isArray(candidate.message.content)
    ) continue;

    for (const part of candidate.message.content) {
      if (!part || typeof part !== "object") continue;
      const call = part as { type?: string; id?: string; name?: string; arguments?: unknown };
      if (
        call.type === "toolCall" && call.name === "read" && call.id &&
        successfulReads.has(call.id) &&
        toolReadsPath(call.name, call.arguments, boundary.standards, cwd)
      ) return true;
    }
  }

  return false;
}

function branchHasReadNudge(branch: readonly unknown[], boundary: Boundary): boolean {
  return branch.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as {
      type?: string;
      customType?: string;
      details?: { kind?: string; boundary?: string };
    };
    return candidate.type === "custom_message" && candidate.customType === MESSAGE_TYPE &&
      candidate.details?.kind === "read" && candidate.details.boundary === boundary.id;
  });
}

function toolReadsPath(toolName: string, input: unknown, path: string, cwd: string): boolean {
  return toolName === "read" && toolPath(input) !== undefined &&
    resolveToolPath(toolPath(input)!, cwd) === resolve(cwd, path);
}

function toolPath(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return;
  const path = (input as { path?: unknown }).path;
  return typeof path === "string" ? path : undefined;
}

function patchPaths(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const patch = (input as { input?: unknown }).input;
  if (typeof patch !== "string") return [];
  return [
    ...patch.matchAll(/^\*\*\* (?:Add|Update|Replace|Delete) File: (.+)$/gm),
    ...patch.matchAll(/^\*\*\* Move to: (.+)$/gm),
  ]
    .map((match) => match[1]);
}

function pathIsWithin(path: string, root: string, cwd: string): boolean {
  const child = resolveToolPath(path, cwd);
  const parent = resolve(cwd, root);
  const pathFromRoot = relative(parent, child);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function resolveToolPath(path: string, cwd: string): string {
  return resolve(cwd, path.startsWith("@") ? path.slice(1) : path);
}

function sendReadNudge(pi: ExtensionAPI, boundary: Boundary): void {
  pi.sendMessage({
    customType: MESSAGE_TYPE,
    content:
      `You read from ${boundary.root}/. If you intend to change code in this boundary, read ${boundary.standards} first and follow it. Otherwise, do not load that standards file merely because of this reminder.`,
    display: false,
    details: { kind: "read", boundary: boundary.id },
  }, { deliverAs: "steer" });
}

function sendWriteNudge(pi: ExtensionAPI, boundary: Boundary): void {
  pi.sendMessage({
    customType: MESSAGE_TYPE,
    content:
      `You changed code in ${boundary.root}/ without first reading ${boundary.standards}. Read it now, then verify the implementation follows those standards before making further changes.`,
    display: false,
    details: { kind: "write", boundary: boundary.id },
  }, { deliverAs: "steer" });
}
