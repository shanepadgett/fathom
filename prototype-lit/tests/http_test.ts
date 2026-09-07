import { assertEquals } from "@std/assert";
import { Controller } from "../src/host/controller.ts";
import { createHandler } from "../src/host/http.ts";
import { appRoot, readConfig } from "../src/host/config.ts";
Deno.test("external composition registers backend and frontend modules", async () => {
  const app = new Controller({
    ...readConfig(),
    workspace: appRoot,
    composition: `${appRoot}/examples/composition.json`,
  });
  try {
    await app.init();
    const bootstrap = app.bootstrap();
    assertEquals(bootstrap.tools.some((t) => t.name === "clock"), true);
    const handle = createHandler(app);
    const html = await handle(new Request("http://localhost/"));
    assertEquals(html.status, 200);
    assertEquals((await html.text()).includes("<title>"), true);
    const url = bootstrap.uiPlugins.find((p) => p.startsWith("/extensions/"))!;
    const module = await handle(new Request(`http://localhost${url}`));
    assertEquals(module.status, 200);
    assertEquals((await module.text()).includes("session-inspector"), true);
    const bad = await handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: 3 }),
      }),
    );
    assertEquals(bad.status, 400);
  } finally {
    await app.dispose();
  }
});
Deno.test("runtime profile switch starts a clean session through the same API", async () => {
  const app = new Controller({
    ...readConfig(),
    workspace: appRoot,
    composition: undefined,
    profile: "echo",
  });
  try {
    await app.init();
    app.send("hello");
    await app.wait();
    assertEquals(app.bootstrap().session.messages.length, 2);
    const id = app.bootstrap().session.id;
    await app.switchProfile("default");
    assertEquals(app.bootstrap().runtime, "agent");
    assertEquals(app.bootstrap().session.messages.length, 0);
    assertEquals(app.bootstrap().session.id === id, false);
  } finally {
    await app.dispose();
  }
});
