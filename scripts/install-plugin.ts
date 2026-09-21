import { resolve } from "node:path";
import { decode, PluginConfigSchema, T } from "@fathom/sdk";
import { discover } from "@fathom/server";

const [action, directory] = Deno.args;

if (!["add", "remove"].includes(action) || !directory) {
  throw new Error(
    "Usage: deno task plugin:add|plugin:remove /absolute/plugin/directory",
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

  const temp = `${path}.${crypto.randomUUID()}.tmp`;

  try {
    await Deno.writeTextFile(temp, JSON.stringify(installed, null, 2), {
      mode: 0o600,
    });

    await Deno.rename(temp, path);
  } catch (error) {
    try {
      await Deno.remove(temp);
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw new AggregateError(
          [error, e],
          "Write and temporary file cleanup failed",
        );
      }
    }

    throw error;
  }

  console.log(
    `${
      action === "add"
        ? "Registered trusted local source"
        : "Removed registration"
    }: ${source}\nRun deno task build:ui, then restart the host to apply installation changes. Existing plugins support live reload.`,
  );
} finally {
  lock.close();
}
