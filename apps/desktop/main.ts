import { boot } from "@fathom/host-deno";
import { resolve } from "node:path";

const resources = resolve(import.meta.dirname!, "../..");

const home = resolve(
  Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
);

const port = Number(Deno.env.get("FATHOM_PORT") ?? 5173);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("FATHOM_PORT must be an integer between 1024 and 65535");
}

if (!Deno.args.includes("--browser")) {
  throw new Error(
    "Native desktop packaging is not established yet. Use deno task dev for the browser host.",
  );
}

try {
  await Deno.stat(`${resources}/dist/app/index.html`);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) {
    throw error;
  }

  throw new Error("Build the UI first: deno task build:ui", { cause: error });
}

const { launchToken, close } = await boot({ home, resources, port });
const url = `http://127.0.0.1:${port}/#token=${launchToken}`;

console.log(`Fathom is running.\n${url}\nCredentials: ${home}/auth.json`);

let stopping = false;

const shutdown = async () => {
  if (stopping) {
    return;
  }

  stopping = true;

  try {
    await close();
    Deno.exit(0);
  } catch (error) {
    console.error(String(error));
    Deno.exit(1);
  }
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

if (!Deno.args.includes("--no-open")) {
  let command = ["xdg-open", url];

  if (Deno.build.os === "darwin") {
    command = ["open", url];
  } else if (Deno.build.os === "windows") {
    command = ["cmd", "/c", "start", "", url];
  }

  try {
    await new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: "null",
      stderr: "null",
    }).output();
  } catch {
    // The printed link also works without a desktop opener.
  }
}
