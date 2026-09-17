import type { ToolExecution } from "../../sdk/session.ts";

const fileTools = new Map<string, { label: string; action: string }>([
  ["read", { label: "Read file", action: "read" }],
  ["edit", { label: "Edit file", action: "edited" }],
  ["write", { label: "Write file", action: "written" }],
]);

export function toolLabel(run: ToolExecution) {
  const name = fileTools.get(run.name)?.label ?? (run.name === "bash" ? "Run command" : run.name);
  const target = run.args.path ?? run.args.command;
  if (typeof target !== "string" || !target) return name;
  const compact = target.replace(/\s+/g, " ").trim();
  return `${name} · ${compact.length > 180 ? `${compact.slice(0, 180)}…` : compact}`;
}

export function toolSummary(runs: ToolExecution[]) {
  const active = runs.find((run) => run.status === "running");
  if (active) return toolLabel(active);
  const pending = runs.filter((run) => run.status === "pending").length;
  if (pending) return `${pending} ${pending === 1 ? "tool" : "tools"} queued`;
  const counts: string[] = [];
  for (const [name, { action }] of fileTools) {
    const count = new Set(
      runs
        .filter(
          (run) =>
            run.name === name && run.status === "completed" && typeof run.args.path === "string",
        )
        .map((run) => run.args.path),
    ).size;
    if (count) {
      counts.push(`${count} ${count === 1 ? "file" : "files"} ${action}`);
    }
  }
  const other = runs.filter(
    (run) =>
      run.status === "completed" && (!fileTools.has(run.name) || typeof run.args.path !== "string"),
  ).length;
  if (other) counts.push(`${other} ${other === 1 ? "tool" : "tools"} ran`);
  const failed = runs.filter((run) => run.status === "error").length;
  const cancelled = runs.filter((run) => run.status === "aborted").length;
  if (failed) counts.push(`${failed} failed`);
  if (cancelled) counts.push(`${cancelled} cancelled`);
  return counts.join(" · ") || "No tool calls yet";
}

export function toolFile(run: ToolExecution) {
  if (!fileTools.has(run.name) || typeof run.args.path !== "string" || !run.args.path.trim())
    return;
  const start = run.args.offset;
  const limit = run.args.limit;
  const startLine = Number.isSafeInteger(start) && Number(start) > 0 ? Number(start) : 1;
  const count =
    Number.isSafeInteger(limit) && Number(limit) > 0 ? Math.min(Number(limit), 3000) : 1;
  return {
    path: run.args.path,
    changed: run.name !== "read" && run.status === "completed",
    range: run.name === "read" ? { startLine, endLine: startLine + count - 1 } : undefined,
  };
}
