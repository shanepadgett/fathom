import { assert, assertEquals, assertRejects } from "@std/assert";
import { runLoop } from "../src/plugins/runtime-agent/loop.ts";
import { MemorySession } from "../src/plugins/session-memory.ts";
import { Registry } from "../src/plugins/tools/registry.ts";
import { runBash } from "../src/plugins/tools/process.ts";
import type { ModelService } from "../src/contracts/model.ts";
Deno.test("tool errors settle into history and allow the model to recover", async () => {
  const sessions = new MemorySession();
  const tools = new Registry();
  let requests = 0;
  const model: ModelService = {
    info: { provider: "test", id: "scripted" },
    respond(input) {
      requests++;
      if (requests === 1) {
        return Promise.resolve({
          text: "",
          calls: [{ id: "a", name: "missing", arguments: {} }],
          stop: "tools",
        });
      }
      const last = input.messages.at(-1)!;
      assert(last.role === "tool" && last.isError);
      return Promise.resolve({ text: "Recovered", calls: [], stop: "done" });
    },
  };
  await runLoop("test", new AbortController().signal, {
    model,
    sessions,
    tools,
    context: { build: (input) => ({ ...input, system: "test" }) },
  });
  assertEquals(requests, 2);
  assertEquals(sessions.snapshot().messages.at(-1)?.text, "Recovered");
});
Deno.test("cancellation settles remaining tool calls without executing them", async () => {
  const sessions = new MemorySession();
  const tools = new Registry();
  const abort = new AbortController();
  let calls = 0;
  tools.register({
    name: "cancel",
    description: "test",
    parameters: {},
    execute() {
      calls++;
      abort.abort(new Error("stop"));
      return Promise.resolve("first complete");
    },
  });
  const model: ModelService = {
    info: { provider: "test", id: "scripted" },
    respond: () =>
      Promise.resolve({
        text: "",
        calls: [{ id: "a", name: "cancel", arguments: {} }, {
          id: "b",
          name: "cancel",
          arguments: {},
        }],
        stop: "tools",
      }),
  };
  await assertRejects(
    () =>
      runLoop("test", abort.signal, {
        model,
        sessions,
        tools,
        context: { build: (input) => ({ ...input, system: "test" }) },
      }),
    Error,
    "stop",
  );
  assertEquals(calls, 1);
  assertEquals(sessions.history.filter((m) => m.role === "tool").length, 2);
});
Deno.test("bash cancellation closes shell children and output pipes", async () => {
  const abort = new AbortController();
  const started = Date.now();
  const task = runBash("sleep 30 & wait", Deno.cwd(), abort.signal);
  const timer = setTimeout(() => abort.abort(new Error("stop")), 100);
  try {
    await assertRejects(() => task, Error, "stop");
    assert(Date.now() - started < 3000);
  } finally {
    clearTimeout(timer);
  }
});
Deno.test("bash timeout is visible in its result", async () => {
  const result = await runBash(
    "sleep 30 & wait",
    Deno.cwd(),
    new AbortController().signal,
    100,
  );
  assert(result.includes("timeout"));
});
