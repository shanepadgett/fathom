import { resolve } from "node:path";
import { openBrowserTab } from "./browser.ts";
import { desktopRuntime, openDesktop } from "./window.ts";

// A packaged app embeds dist/ and plugins/ beside this module. Development runs
// point at the checkout so rebuilt assets and edited plugins are read in place.
const resources = resolve(
  Deno.env.get("FATHOM_RESOURCES") ?? resolve(import.meta.dirname!, "../.."),
);

const home = resolve(
  Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
);

try {
  await Deno.stat(`${resources}/dist/app/index.html`);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) {
    throw error;
  }

  throw new Error("Build the UI first: deno task build:ui", { cause: error });
}

const BrowserWindow = desktopRuntime();

if (BrowserWindow) {
  await openDesktop(BrowserWindow, { home, resources });
} else {
  const port = Number(Deno.env.get("FATHOM_PORT") ?? 5173);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("FATHOM_PORT must be an integer between 1024 and 65535");
  }

  await openBrowserTab({
    home,
    resources,
    port,
    open: !Deno.args.includes("--no-open"),
  });
}
