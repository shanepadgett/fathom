import { join } from "node:path";
import { Kernel } from "@fathom/kernel";
import { AppEnvironment, decode, T, UiArtifactSchema } from "@fathom/sdk";
import { CompositionStore } from "./composition.ts";
import { bridge } from "./bridge.ts";
import { discover } from "./discovery.ts";
import { DenoLoader } from "./loader.ts";
import { openInBrowser } from "./open-browser.ts";

export async function boot(options: {
  home: string;
  resources: string;
  launchToken: string;
  shell: "desktop" | "browser";
  /** Fixed loopback port for browser mode; the desktop runtime assigns its own. */
  port?: number;
}): Promise<{ kernel: Kernel; origin: string; close(): Promise<void> }> {
  await Deno.mkdir(options.home, { recursive: true, mode: 0o700 });

  const lock = await Deno.open(join(options.home, "host.lock"), {
    create: true,
    write: true,
    mode: 0o600,
  });

  const state = new CompositionStore(join(options.home, "composition.json"));
  let transport: ReturnType<typeof bridge> | undefined;
  let kernel: Kernel | undefined;

  try {
    if (!(await lock.tryLock(true))) {
      throw new Error("Another Fathom host is using this home");
    }

    await state.load();

    kernel = new Kernel(
      "backend",
      new DenoLoader(options.home),
      async (statuses) => {
        await state.update(undefined, {
          backend: Object.fromEntries(
            statuses.map((p) => [
              p.id,
              { enabled: p.desired.enabled, config: p.desired.config },
            ]),
          ),
        });
      },
    );

    const manifests = await discover(options.resources, options.home);

    transport = bridge(kernel, options, state, async () => {
      const artifacts = decode(
        T.Array(T.Omit(UiArtifactSchema, ["enabled", "config"])),
        JSON.parse(
          await Deno.readTextFile(
            join(options.resources, "dist", "app", "ui-plugins.json"),
          ),
        ),
      );

      const sources = new Map(
        manifests
          .filter((m) => m.manifest.ui)
          .map((m) => [m.manifest.id, m.source]),
      );

      return artifacts.flatMap((artifact) => {
        const source = sources.get(artifact.id);

        if (!source) {
          return [];
        }

        return [
          {
            ...artifact,
            enabled:
              state.value.ui[artifact.id]?.enabled ??
              source.startsWith(`${options.resources}/plugins/`),
            config: state.value.ui[artifact.id]?.config ?? {},
          },
        ];
      });
    });

    kernel.provide(AppEnvironment, {
      home: options.home,
      resources: options.resources,
      platform: Deno.build.os,
      origin: transport.origin,
      launchToken: options.launchToken,
      shell: options.shell,
      openExternal: openInBrowser,
    });

    for (const { source, manifest } of manifests) {
      if (!manifest.backend) {
        continue;
      }

      const desired = state.value.backend[manifest.id];

      kernel.add({
        id: manifest.id,
        source,
        config: desired?.config ?? {},
        enabled:
          desired?.enabled ??
          source.startsWith(`${options.resources}/plugins/`),
      });
    }

    await kernel.start();

    const activeKernel = kernel;
    const activeTransport = transport;

    return {
      kernel,
      origin: activeTransport.origin,
      close: async () => {
        try {
          await activeKernel.shutdown();
        } finally {
          try {
            await activeTransport.close();
          } finally {
            lock.close();
          }
        }
      },
    };
  } catch (e) {
    try {
      await kernel?.shutdown();
    } finally {
      try {
        await transport?.close();
      } finally {
        lock.close();
      }
    }

    throw e;
  }
}
