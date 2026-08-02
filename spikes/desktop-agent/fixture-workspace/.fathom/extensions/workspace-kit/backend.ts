import { RESULT_LABEL } from "./shared.ts";

export function activate(api: any): void {
  api.registerTool({
    name: "workspace_stats",
    label: RESULT_LABEL,
    description: "Count files and total bytes in the selected workspace.",
    parameters: api.Type.Object({}),
    async execute() {
      const stats = await workspaceStats(api.workspace);
      return {
        content: [{ type: "text", text: `${stats.files} files, ${stats.bytes} bytes` }],
        details: { ...stats, label: RESULT_LABEL },
      };
    },
  });
  api.registerCommand({
    name: "workspace-stats",
    description: "Count files in the current workspace",
    async run() {
      const stats = await workspaceStats(api.workspace);
      return `${RESULT_LABEL}: ${stats.files} files, ${stats.bytes} bytes`;
    },
  });
}

async function workspaceStats(root: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  for await (const entry of Deno.readDir(root)) {
    if (entry.name === ".fathom") continue;
    const path = `${root}/${entry.name}`;
    if (entry.isFile) {
      const info = await Deno.stat(path);
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
}
