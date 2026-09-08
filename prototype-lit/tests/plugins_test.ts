import { assertEquals, assertRejects } from "@std/assert";

import { PluginHost } from "../src/kernel/host.ts";
import echo from "../src/plugins/runtime-echo.ts";
import sessions from "../src/plugins/session-memory.ts";
import bash from "../src/plugins/tools/bash.ts";
import edit from "../src/plugins/tools/edit.ts";
import read from "../src/plugins/tools/read.ts";
import registry from "../src/plugins/tools/registry.ts";
import write from "../src/plugins/tools/write.ts";
import { workspacePlugin } from "../src/plugins/workspace-local.ts";
Deno.test("composition resolves dependency order and disposes registrations", async () => {
  const host = new PluginHost();
  await host.mount([echo, sessions]);
  const session = host.get("sessions");
  await host.get("runtime").run("hello", new AbortController().signal);
  assertEquals(session.snapshot().messages.length, 2);
  await host.dispose();
  assertEquals(host.context.get("fathom:runtime"), undefined);
});
Deno.test("invalid compositions fail before activation", async () => {
  const host = new PluginHost();
  await assertRejects(() => host.mount([echo]), Error, "Missing or cyclic");
  await assertRejects(
    () => host.mount([sessions, { ...sessions, id: "other" }]),
    Error,
    "Duplicate service",
  );
  await host.dispose();
});
Deno.test("file plugins and bash execute in the selected workspace", async () => {
  const root = await Deno.makeTempDir();
  const host = new PluginHost();
  try {
    await host.mount([read, write, edit, bash, registry, workspacePlugin(root)]);
    const tools = host.get("tools");
    const signal = new AbortController().signal;
    await tools.execute("write", { path: "a/b.txt", content: "alpha beta" }, signal);
    assertEquals(await tools.execute("read", { path: "a/b.txt" }, signal), "alpha beta");
    await tools.execute(
      "edit",
      {
        path: "a/b.txt",
        oldText: "beta",
        newText: "gamma",
      },
      signal,
    );
    assertEquals(await Deno.readTextFile(`${root}/a/b.txt`), "alpha gamma");
    await assertRejects(
      () => tools.execute("edit", { path: "a/b.txt", oldText: "a", newText: "b" }, signal),
      Error,
      "exactly once",
    );
    assertEquals(
      await tools.execute("bash", { command: "cat a/b.txt" }, signal),
      "exit=0\nalpha gamma",
    );
    await host.dispose();
    assertEquals(tools.list().length, 0);
  } finally {
    await host.dispose();
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("activation failure disposes already registered effects", async () => {
  const host = new PluginHost();
  let alive = false;
  await assertRejects(
    () =>
      host.mount([
        {
          id: "bad",
          apiVersion: 1,
          activate(ctx) {
            ctx.effect(() => {
              alive = true;
              return () => {
                alive = false;
              };
            });
            throw new Error("activation failed");
          },
        },
      ]),
    Error,
  );
  assertEquals(alive, false);
  assertEquals(host.describe().length, 0);
});
