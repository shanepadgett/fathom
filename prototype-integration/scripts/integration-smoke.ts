import { Controller } from "../src/host/controller.ts";
import { readConfig } from "../src/host/config.ts";
import { createHandler } from "../src/host/http.ts";
import { chromium } from "npm:playwright@1.58.2";
import mcpHttp from "../examples/mcp-http.ts";

const root = await Deno.makeTempDir({ prefix: "fathom-integration-" });
Deno.env.set("FATHOM_DB", `${root}/sessions.db`);
await Deno.writeTextFile(`${root}/deno.json`, "{}");
await Deno.writeTextFile(
  `${root}/issues.ts`,
  'export const answer: number = "wrong";\n',
);
const config = { ...readConfig(), workspace: root, profile: "echo" };
let controller = new Controller(config);
let server: Deno.HttpServer<Deno.NetAddr> | undefined;
let browser;
let remote: Deno.HttpServer<Deno.NetAddr> | undefined;
async function check(condition: unknown, label: string) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
try {
  await controller.init();
  const action = (name: string, args: Record<string, unknown> = {}) =>
    controller.workbenchCommand(name, args);
  async function job(
    name: string,
    args: Record<string, unknown>,
    approve = false,
  ) {
    const started = await action("tool", { name, args }) as { id: string };
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const state = await controller.workbenchState();
      if (approve) {
        for (const a of state.approvals) {
          await action("approve", { id: a.id, allow: true });
        }
      }
      const result = state.jobs.find((j) => j.id === started.id)!;
      if (result.status !== "running") {
        if (result.status === "error") throw new Error(result.result);
        return result.result!;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timed out: ${name}`);
  }
  await action("open", { path: "issues.ts" });
  const issues = JSON.parse(await job("diagnostics", { path: "issues.ts" }));
  await check(
    !issues.pending &&
      issues.diagnostics.some((d: { code: number }) => d.code === 2322),
    "real Deno LSP reports type error to agent tool",
  );
  const doc = JSON.parse(await job("editor_read", { path: "issues.ts" }));
  const fixed = JSON.parse(
    await job("editor_edit", {
      path: "issues.ts",
      version: doc.version,
      oldText: '"wrong"',
      newText: "42",
    }),
  );
  await check(
    !fixed.pending && !fixed.diagnostics.length,
    "agent edit clears diagnostics and saves file",
  );
  await action("connect-fixture");
  await check(
    (await job("mcp_greet", { name: "Fathom" }, true)).includes(
      "Hello, Fathom!",
    ),
    "MCP stdio discovery and call",
  );
  await check(
    (await job("script", {
      code:
        'import { mcp } from "fathom:mcp"; console.log(await mcp.greet({name:"Script"}));',
    }, true)).includes("Hello, Script!"),
    "approved Deno script calls MCP through server bridge",
  );
  remote = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    mcpHttp.fetch,
  );
  await action("connect", { url: `http://127.0.0.1:${remote.addr.port}/mcp` });
  await check(
    (await job("mcp_greet", { name: "HTTP" }, true)).includes("Hello, HTTP!"),
    "MCP Streamable HTTP discovery and call",
  );
  const firstScript = await job("script", {
    runtime: "python3",
    code: 'print("PYTHON_PROOF")',
  }, true);
  await check(
    firstScript.includes("PYTHON_PROOF") && firstScript.includes("exit=0"),
    "approved Python child process",
  );
  const scriptId = firstScript.split("\n")[0].slice("scriptId=".length);
  await check(
    (await job("script", {
      scriptId,
      oldText: "PYTHON_PROOF",
      newText: "PATCH_PROOF",
    }, true)).includes("PATCH_PROOF"),
    "saved script patch and reapproval",
  );
  await action("terminal-start");
  const denied = await action("tool", {
    name: "script",
    args: { code: 'throw new Error("MUST_NOT_RUN")' },
  }) as { id: string };
  for (const approval of (await controller.workbenchState()).approvals) {
    await action("approve", { id: approval.id, allow: false });
  }
  await new Promise((r) => setTimeout(r, 50));
  await check(
    (await controller.workbenchState()).jobs.find((j) => j.id === denied.id)
      ?.status === "error",
    "denied script never runs",
  );
  await action("terminal-resize", { cols: 97, rows: 31 });
  await action("terminal-write", { data: "printf 'PTY_PROOF'; stty size\n" });
  await new Promise((r) => setTimeout(r, 1000));
  const terminal = (await controller.workbenchState()).terminal;
  await check(
    terminal.output.includes("PTY_PROOF") && terminal.output.includes("31 97"),
    "PTY runs shell and applies resize",
  );
  await action("terminal-stop");
  controller.send(
    "# Saved conversation\n\n```typescript\nconst answer = 42;\n```",
  );
  await controller.wait();
  const saved = controller.bootstrap().session.id;
  await controller.dispose();
  controller = new Controller(config);
  await controller.init();
  await check(
    controller.bootstrap().session.id === saved &&
      controller.bootstrap().session.messages.length === 2,
    "Drizzle migration and conversation recovery after restart",
  );
  server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    createHandler(controller),
  );
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.addr.port}`);
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".monaco-container")?.getAttribute(
      "data-marker-count",
    ) === "0"
  );
  await check(
    await page.locator(".markdown .shiki").count() > 0,
    "Markdown and Shiki rendered in Solid UI",
  );
  await page.locator(".monaco-container").click();
  await page.keyboard.press("Meta+a");
  await page.keyboard.insertText('export const answer: number = "unsaved";');
  await page.waitForFunction(() =>
    Number(
      document.querySelector(".monaco-container")?.getAttribute(
        "data-marker-count",
      ),
    ) > 0
  );
  const shared = JSON.parse(await job("diagnostics", { path: "issues.ts" }));
  await check(
    shared.diagnostics.some((d: { code: number }) => d.code === 2322),
    "unsaved Monaco text reaches the same agent diagnostic store",
  );
  const latest = JSON.parse(await job("editor_read", { path: "issues.ts" }));
  await job("editor_edit", {
    path: "issues.ts",
    version: latest.version,
    oldText: '"unsaved"',
    newText: "42",
  });
  await page.waitForFunction(() =>
    document.querySelector(".monaco-container")?.getAttribute(
      "data-marker-count",
    ) === "0"
  );
  await check(
    !errors.length,
    `browser has no uncaught errors: ${errors.join(", ")}`,
  );
  await page.screenshot({
    path: "/tmp/fathom-integration.png",
    fullPage: true,
  });
  console.log(
    "PASS: editor markers clear after agent fix; screenshot /tmp/fathom-integration.png",
  );
} finally {
  await browser?.close();
  await controller.dispose();
  await server?.shutdown();
  await remote?.shutdown();
  await Deno.remove(root, { recursive: true });
}
