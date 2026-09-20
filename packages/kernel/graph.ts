import type { Graph } from "@fathom/sdk";
import type { PluginRecord } from "./plugin-record.ts";
import type { KernelRegistry } from "./registry.ts";

export function describeGraph(
  records: Iterable<PluginRecord>,
  host: "backend" | "ui",
  services: ReadonlyMap<string, { owner: string }>,
  registries: ReadonlyMap<
    string,
    { owner: string; registry: KernelRegistry<unknown> }
  >,
): Graph {
  const nodes = [...records].map((r) => ({
    id: r.status.id,
    host: host,
    provides: Object.values(r.def?.provides ?? {}).map((t) => t.id),
    requires: Object.values(r.def?.requires ?? {}).map((t) => t.id),
    contributes: Object.fromEntries(
      [...registries]
        .map(([id, v]) => [id, v.registry.contributions(r.status.id)])
        .filter(([, ids]) => ids.length),
    ),
  }));

  return {
    nodes,
    edges: nodes.flatMap((n) =>
      n.requires.map((token) => ({
        from: n.id,
        to:
          services.get(token)?.owner ??
          registries.get(token)?.owner ??
          nodes.find((p) => p.provides.includes(token))?.id ??
          "unavailable",
        token,
      })),
    ),
  };
}
