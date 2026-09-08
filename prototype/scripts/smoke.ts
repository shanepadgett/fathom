import { assertEquals } from "@std/assert";

import { readConfig } from "../src/host/config.ts";
import { Controller } from "../src/host/controller.ts";
const workspace = await Deno.makeTempDir({ prefix: "fathom-smoke-" });
const controller = new Controller({
  ...readConfig(),
  workspace,
  composition: undefined,
  profile: "default",
});
try {
  await controller.init();
  const used = new Set<string>();
  controller.subscribe((event) => {
    if (event.type === "tool-start") {
      used.add(event.name);
      console.log(`Tool: ${event.name}`);
    }
    if (event.type === "error") console.error(event.message);
  });
  controller.send(
    'Verify all four tools in this temporary workspace. Use write to create proof.txt containing exactly "alpha\\n". Use read to inspect it. Use edit to replace "alpha" with "beta". Use bash to run "cat proof.txt". Finish with a concise result. Do not use bash to write or edit.',
  );
  await controller.wait();
  assertEquals(controller.bootstrap().session.status, "idle");
  assertEquals(await Deno.readTextFile(`${workspace}/proof.txt`), "beta\n");
  assertEquals([...used].sort(), ["bash", "edit", "read", "write"]);
  console.log("PASS: pi OAuth + streamed model + read/write/edit/bash; file verified on disk.");
  await controller.switchProfile("echo");
  controller.send("replacement proof");
  await controller.wait();
  assertEquals(controller.bootstrap().runtime, "echo");
  assertEquals(controller.bootstrap().session.messages.length, 2);
  console.log("PASS: runtime replacement through the same controller contract.");
} finally {
  await controller.dispose();
  await Deno.remove(workspace, { recursive: true });
}
