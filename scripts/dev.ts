import { discover } from "@fathom/server";
import * as esbuild from "esbuild";
import { dirname, resolve, sep } from "node:path";
import {
  buildApp,
  buildPluginArtifact,
  type DiscoveredPlugin,
  writeCatalog,
} from "./bundling/build-app.ts";

/**
 * The development loop: build, launch Fathom, then rebuild and reload the
 * plugin that changed. `--browser` runs the browser fallback for DevTools.
 */

const DEBOUNCE_MS = 200;

const root = resolve(import.meta.dirname!, "..");

const home = resolve(
  Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
);

const browser = Deno.args.includes("--browser");
const token = crypto.randomUUID() + crypto.randomUUID();

const plugins = await discover(root, home);
let artifacts = await buildApp(root, plugins);
console.log(`Built app and ${artifacts.length} UI plugins.`);

const child = new Deno.Command(Deno.execPath(), {
  args: browser
    ? ["run", "-A", "apps/desktop/main.ts"]
    : [
        "desktop",
        "-A",
        "--hmr",
        "--exclude-unused-npm",
        "apps/desktop/main.ts",
      ],
  cwd: root,
  env: { FATHOM_RESOURCES: root, FATHOM_LAUNCH_TOKEN: token },
  stdout: "piped",
  stderr: "inherit",
}).spawn();

const origin = Promise.withResolvers<string>();

// Echo the app's output and pick up the origin it announces.
void (async () => {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of child.stdout) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");

    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      console.log(line);

      const match = /https?:\/\/127\.0\.0\.1:\d+/.exec(line);

      if (match) {
        origin.resolve(match[0]);
      }

      newline = buffer.indexOf("\n");
    }
  }
})();

async function post(path: string) {
  const response = await fetch(`${await origin.promise}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
}

type Half = "ui" | "backend";

function classify(plugin: DiscoveredPlugin, path: string): Half[] {
  const dir = resolve(plugin.source, "..");
  const relative = path.slice(dir.length + 1);
  const { ui, backend } = plugin.manifest;

  if (ui && relative.startsWith(dirname(ui) + sep)) {
    return ["ui"];
  }

  if (backend && relative.startsWith(dirname(backend) + sep)) {
    return ["backend"];
  }

  // Shared files such as the contract affect both halves.
  return [
    ...(ui ? ["ui" as const] : []),
    ...(backend ? ["backend" as const] : []),
  ];
}

async function apply(plugin: DiscoveredPlugin, halves: Set<Half>) {
  const id = plugin.manifest.id;

  try {
    if (halves.has("ui")) {
      const artifact = await buildPluginArtifact(root, plugin);
      artifacts = artifacts.map((item) => (item.id === id ? artifact : item));
      await writeCatalog(root, artifacts);
      await post("/api/ui-plugins/refresh");
      console.log(`${id}: UI rebuilt and reloaded`);
    }

    if (halves.has("backend")) {
      await post(`/api/plugins/${encodeURIComponent(id)}/reload`);
      console.log(`${id}: backend reloaded`);
    }
  } catch (error) {
    console.error(`${id}: ${error instanceof Error ? error.message : error}`);
  }
}

const pending = new Map<
  string,
  { halves: Set<Half>; timer: ReturnType<typeof setTimeout> | undefined }
>();

function schedule(plugin: DiscoveredPlugin, halves: Half[]) {
  const id = plugin.manifest.id;
  const entry = pending.get(id) ?? {
    halves: new Set<Half>(),
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  };

  for (const half of halves) {
    entry.halves.add(half);
  }

  clearTimeout(entry.timer);

  entry.timer = setTimeout(() => {
    pending.delete(id);
    void apply(plugin, entry.halves);
  }, DEBOUNCE_MS);

  pending.set(id, entry);
}

const stop = () => {
  try {
    child.kill("SIGTERM");
  } catch {
    // Already exited.
  }
};

Deno.addSignalListener("SIGINT", stop);
Deno.addSignalListener("SIGTERM", stop);

void child.status.then((status) => {
  esbuild.stop();
  Deno.exit(status.code);
});

const watched = plugins.map((plugin) => resolve(plugin.source, ".."));

for await (const event of Deno.watchFs(watched)) {
  if (!["modify", "create", "remove"].includes(event.kind)) {
    continue;
  }

  for (const path of event.paths) {
    if (
      path.includes(`${sep}node_modules${sep}`) ||
      path.includes(`${sep}dist${sep}`)
    ) {
      continue;
    }

    const plugin = plugins.find((item) =>
      path.startsWith(resolve(item.source, "..") + sep),
    );

    if (plugin) {
      schedule(plugin, classify(plugin, path));
    }
  }
}
