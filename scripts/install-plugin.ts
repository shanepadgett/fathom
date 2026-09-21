import { resolve } from "node:path";
import { decode, PluginConfigSchema, T } from "@fathom/sdk";
import { discover, writeJsonAtomic } from "@fathom/server";

const [action, directory] = Deno.args;

if (!["add", "remove"].includes(action) || !directory) {
  throw new Error(
    "Usage: mise run plugin:add|plugin:remove /absolute/plugin/directory",
  );
}

const resources = resolve(import.meta.dirname!, "..");

const home = resolve(
  Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
);

await Deno.mkdir(home, { recursive: true, mode: 0o700 });

const lock = await Deno.open(`${home}/installation.lock`, {
  create: true,
  write: true,
  mode: 0o600,
});

try {
  if (!(await lock.tryLock(true))) {
    throw new Error("Another installation is in progress");
  }

  const path = `${home}/plugins.json`;
  const source = resolve(directory, "deno.json");
  let installed: string[] = [];

  try {
    installed = decode(
      T.Array(T.String()),
      JSON.parse(await Deno.readTextFile(path)),
    );
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }

  if (action === "add") {
    const manifest = decode(
      PluginConfigSchema,
      JSON.parse(await Deno.readTextFile(source)),
    ).fathom;

    const existing = await discover(resources, home);

    if (
      existing.some((m) => m.manifest.id === manifest.id && m.source !== source)
    ) {
      throw new Error(`Plugin id already registered: ${manifest.id}`);
    }

    if (!manifest.backend && !manifest.ui) {
      throw new Error("Plugin needs a backend or UI entry");
    }

    if (!installed.includes(source)) {
      installed.push(source);
    }
  } else {
    installed = installed.filter((p) => p !== source);
  }

  await writeJsonAtomic(path, installed);

  console.log(
    `${
      action === "add"
        ? "Registered trusted local source"
        : "Removed registration"
    }: ${source}\nRun mise run build:ui, then restart the host to apply installation changes. Existing plugins support live reload.`,
  );
} finally {
  lock.close();
}
