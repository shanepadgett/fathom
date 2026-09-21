import type { PluginDef } from "@fathom/sdk";

export function assertPluginDefinition(def: PluginDef) {
  if (
    !def ||
    !/^[-a-zA-Z0-9_.]+$/.test(def.id) ||
    typeof def.start !== "function" ||
    !def.requires ||
    !def.provides ||
    !def.config
  ) {
    throw new Error("Invalid plugin definition");
  }

  for (const key of Object.keys(def.requires)) {
    if (key in def.provides) {
      throw new Error(`Duplicate dependency key ${key}`);
    }
  }

  for (const key of [
    ...Object.keys(def.requires),
    ...Object.keys(def.provides),
  ]) {
    if (key === "scope" || key === "handoff") {
      throw new Error(`Reserved dependency key ${key}`);
    }
  }

  const ids = new Set<string>();

  for (const token of Object.values(def.provides)) {
    if (ids.has(token.id)) {
      throw new Error(`Duplicate provided token ${token.id}`);
    }

    ids.add(token.id);
  }

  for (const token of [
    ...Object.values(def.requires),
    ...Object.values(def.provides),
  ]) {
    if (!token?.id || !["service", "registry"].includes(token.kind)) {
      throw new Error("Invalid token");
    }
  }
}
