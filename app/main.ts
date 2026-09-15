import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { atomicWrite } from "./kernel/files.ts";
import { Application } from "./server/application.ts";
import { handler } from "./server/http.ts";
import { createDesktopWindow } from "./server/desktop.ts";
import { NativeBrowserConnection } from "./server/native-browser-connection.ts";
import { restoreDesktopLaunch } from "./server/launch.ts";

const native = await restoreDesktopLaunch();
const appRoot = fileURLToPath(new URL(".", import.meta.url));
const home = Deno.env.get("FATHOM_HOME") ??
  join(Deno.env.get("HOME")!, ".fathom");
const piAuthPath = join(Deno.env.get("HOME")!, ".pi/agent/auth.json");
let defaultAuthPath = join(home, "auth.json");
try {
  await Deno.stat(defaultAuthPath);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  try {
    await Deno.stat(piAuthPath);
    defaultAuthPath = piAuthPath;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}
const authPath = Deno.env.get("FATHOM_PI_AUTH") ?? defaultAuthPath;
const port = Number(Deno.env.get("FATHOM_PORT") ?? 4040);
let origin = `http://127.0.0.1:${port}`;
const publicDir = join(appRoot, "public");

try {
  if (Deno.env.get("FATHOM_DEV")) throw new Error("Rebuild development UI");
  await Deno.stat(join(publicDir, "index.html"));
} catch {
  const { build } = await import("vite");
  await build({ root: appRoot, configFile: join(appRoot, "vite.config.ts") });
}

const app = new Application(home, authPath);
await app.projects.initialize();
try {
  const workspace = Deno.env.get("FATHOM_WORKSPACE") ??
    (native
      ? app.projects.list().find((project) => project.path !== "/")?.path
      : Deno.cwd());
  if (workspace) await app.open(resolve(workspace));
} catch (error) {
  // Keep project selection available when a workspace or its plugin cannot load.
  console.error("Startup workspace could not open:", error);
}
const token = crypto.randomUUID() + crypto.randomUUID();
await atomicWrite(join(home, "server-token"), token);
const server = Deno.serve(
  { hostname: "127.0.0.1", port },
  handler(app, token, () => origin, publicDir),
);
origin = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;
const desktop = createDesktopWindow(stop);
if (desktop?.browser) {
  const browser = desktop.browser;
  app.browserConnection = (event) =>
    new NativeBrowserConnection(browser, event);
}
console.log(`Fathom is ready at ${origin}`);
desktop?.navigate(origin);

let stopping: Promise<void> | undefined;
function stop() {
  return stopping ??= (async () => {
    try {
      await app.dispose();
    } finally {
      await server.shutdown();
    }
  })();
}

function requestShutdown() {
  void (desktop ? desktop.close() : stop()).catch((error) => {
    console.error("Fathom shutdown failed", error);
  });
}

Deno.addSignalListener("SIGINT", requestShutdown);
Deno.addSignalListener("SIGTERM", requestShutdown);
