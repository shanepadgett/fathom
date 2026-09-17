import { fileURLToPath } from "node:url";

import { join, resolve } from "@std/path";

import { start } from "./host.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const built = await Deno.stat(join(publicDir, "index.html")).then(
  () => true,
  () => false,
);
if (Deno.env.get("FATHOM_BASELINE_DEV") || !built) {
  const { build } = await import("vite");
  await build({ root, configFile: join(root, "vite.config.ts") });
}

await start({
  workspace: resolve(Deno.env.get("FATHOM_WORKSPACE") ?? Deno.cwd()),
  home: Deno.env.get("FATHOM_BASELINE_HOME") ?? join(Deno.env.get("HOME")!, ".fathom-baseline"),
  authPath: Deno.env.get("FATHOM_PI_AUTH") ?? join(Deno.env.get("HOME")!, ".pi/agent/auth.json"),
  port: Number(Deno.env.get("FATHOM_BASELINE_PORT") ?? 4050),
  publicDir,
});

const BrowserWindow = (Deno as DesktopRuntime).BrowserWindow;
if (BrowserWindow) {
  new BrowserWindow({
    title: "Fathom Baseline",
    width: 1440,
    height: 940,
  });
}

type DesktopRuntime = typeof Deno & {
  BrowserWindow?: new (options: { title: string; width: number; height: number }) => {
    navigate(url: string): void;
  };
};
