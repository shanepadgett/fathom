import type { PluginRecord } from "./plugin-record.ts";

export function orderPlugins(
  input: Iterable<PluginRecord>,
  ownsHostToken: (id: string) => boolean,
) {
  const records = [...input];
  const result: PluginRecord[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const providers = new Map<string, PluginRecord>();

  for (const r of records) {
    if (r.status.desired.enabled) {
      for (const token of Object.values(r.def?.provides ?? {})) {
        const existing = providers.get(token.id);

        if (existing) {
          throw new Error(
            `Duplicate provider for ${token.id}: ${existing.status.id}, ${r.status.id}`,
          );
        }

        if (ownsHostToken(token.id)) {
          throw new Error(`Plugin cannot own host capability ${token.id}`);
        }

        providers.set(token.id, r);
      }
    }
  }

  const visit = (r: PluginRecord) => {
    if (visited.has(r.status.id)) {
      return;
    }

    if (visiting.has(r.status.id)) {
      throw new Error(`Dependency cycle at ${r.status.id}`);
    }

    visiting.add(r.status.id);

    if (r.status.desired.enabled) {
      for (const token of Object.values(r.def?.requires ?? {})) {
        const p = providers.get(token.id);

        if (p) {
          visit(p);
        }
      }
    }

    visiting.delete(r.status.id);
    visited.add(r.status.id);
    result.push(r);
  };

  for (const r of records) {
    visit(r);
  }

  return result;
}

export function affectedPlugins(
  ordered: PluginRecord[],
  tokens: Set<string>,
  ids = new Set<string>(),
) {
  let changed = true;

  while (changed) {
    changed = false;

    for (const r of ordered) {
      if (
        !ids.has(r.status.id) &&
        Object.values(r.def?.requires ?? {}).some((t) => tokens.has(t.id))
      ) {
        ids.add(r.status.id);

        for (const t of Object.values(r.def?.provides ?? {})) {
          tokens.add(t.id);
        }

        changed = true;
      }
    }
  }

  return ordered.filter((r) => ids.has(r.status.id));
}
