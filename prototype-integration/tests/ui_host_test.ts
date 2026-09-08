import { assertEquals, assertRejects } from "@std/assert";

import { createHost } from "../ui/core/host.js";
import { createState } from "../ui/core/state.js";
Deno.test("UI plugin failure rolls back contributions and permits replacement", async () => {
  const host = createHost(createState(), {});
  await assertRejects(
    () =>
      host.activate({
        id: "broken",
        activate(ctx: typeof host) {
          ctx.registerView("panel", {});
          throw new Error("failed");
        },
      }),
    Error,
    "failed",
  );
  assertEquals(host.views.size, 0);
  await host.activate({
    id: "replacement",
    activate(ctx: typeof host) {
      ctx.registerView("panel", {});
    },
  });
  assertEquals(host.views.size, 1);
  host.dispose();
  assertEquals(host.views.size, 0);
});
Deno.test("UI plugin dependencies and API versions fail explicitly", async () => {
  const host = createHost(createState(), {});
  await assertRejects(
    () => host.activate({ id: "bad", apiVersion: 2, activate() {} }),
    Error,
    "unsupported",
  );
  await assertRejects(
    () => host.activate({ id: "bad", requires: ["missing"], activate() {} }),
    Error,
    "requires",
  );
});
