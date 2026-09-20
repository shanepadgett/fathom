import { Kernel } from "@fathom/kernel";
import { AppEnvironment, decode, T, UiArtifactSchema } from "@fathom/sdk";
import { CompositionStore } from "./composition.ts";
import { bridge } from "./bridge.ts";
import { discover } from "./discovery.ts";
import { DenoLoader } from "./loader.ts";

export async function boot(options: {
  home: string;
  resources: string;
  port: number;
}): Promise<{ kernel: Kernel; launchToken: string; close(): Promise<void> }> {
  await Deno.mkdir(options.home, { recursive: true, mode: 0o700 });

  const lock = await Deno.open(`${options.home}/host.lock`, {
    create: true,
    write: true,
    mode: 0o600,
  });

  const state = new CompositionStore(`${options.home}/composition.json`);
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

    const launchToken = crypto.randomUUID() + crypto.randomUUID();

    kernel.provide(AppEnvironment, {
      ...options,
      platform: Deno.build.os,
      launchToken,
    });

    const manifests = await discover(options.resources, options.home);

    transport = bridge(kernel, { ...options, launchToken }, state, async () => {
      const artifacts = decode(
        T.Array(T.Omit(UiArtifactSchema, ["enabled", "config"])),
        JSON.parse(
          await Deno.readTextFile(
            `${options.resources}/dist/app/ui-plugins.json`,
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
      launchToken,
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
