import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = await Deno.makeTempDir({ prefix: "fathom-native-" });
await Deno.writeTextFile(
  `${root}/issues.ts`,
  'export const answer: number = "wrong";\n',
);
await Deno.writeTextFile(`${root}/deno.json`, "{}");
const child = spawn(resolve("dist/Fathom.app/Contents/MacOS/laufey"), [], {
  env: {
    ...Deno.env.toObject(),
    FATHOM_WORKSPACE: root,
    FATHOM_DB: `${root}/sessions.db`,
    FATHOM_PROFILE: "echo",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (data) => logs += data);
child.stderr.on("data", (data) => logs += data);
const closed = new Promise((done) => child.once("close", done));
try {
  const deadline = Date.now() + 30000;
  while (
    !logs.includes("Listening on") && Date.now() < deadline &&
    child.exitCode === null
  ) await new Promise((r) => setTimeout(r, 100));
  const base = logs.match(/Listening on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  if (!base) throw new Error(logs);
  async function command(action: string, args: Record<string, unknown> = {}) {
    const response = await fetch(`${base}/api/workbench`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, args }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
  }
  await command("open", { path: "issues.ts" });
  await command("terminal-start");
  await command("terminal-write", { data: "printf 'NATIVE_PTY_PROOF\\n'\n" });
  await new Promise((r) => setTimeout(r, 2000));
  const state = await (await fetch(`${base}/api/workbench`)).json();
  if (!state.terminal.output.includes("NATIVE_PTY_PROOF")) {
    throw new Error("Native PTY produced no proof");
  }
  if (!state.documents[0].diagnostics.length) {
    throw new Error("Native LSP produced no diagnostics");
  }
  await command("connect-fixture");
  await command("terminal-stop");
  console.log(
    "PASS: packaged native app starts; embedded migration, PTY library, LSP and MCP fixture work",
  );
} finally {
  child.kill("SIGTERM");
  await closed;
  console.log(logs);
  await Deno.remove(root, { recursive: true });
}
