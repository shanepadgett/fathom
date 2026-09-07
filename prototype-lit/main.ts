import { readConfig } from "./src/host/config.ts";
import { Controller } from "./src/host/controller.ts";
import { createHandler } from "./src/host/http.ts";
const config = readConfig();
const controller = new Controller(config);
await controller.init();
const streams = new AbortController();
const server = Deno.serve(
  { hostname: "127.0.0.1", port: config.port },
  createHandler(controller, streams.signal),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  streams.abort();
  await controller.dispose();
  await server.shutdown();
  Deno.exit(0);
}
Deno.addSignalListener("SIGINT", () => {
  void shutdown();
});
Deno.addSignalListener("SIGTERM", () => {
  void shutdown();
});
globalThis.addEventListener("fathom:close", () => {
  void shutdown();
});
