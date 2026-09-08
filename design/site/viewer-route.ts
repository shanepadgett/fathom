import type { DesignEntry } from "./design-entry.ts";

import { components } from "./component-catalog.ts";
import { screens } from "./screen-catalog.ts";

export interface ViewerRoute {
  kind: "home" | "tokens" | "index" | "entry" | "missing";
  title: string;
  description: string;
  group?: string;
  entries?: DesignEntry[];
  entry?: DesignEntry;
}

export function viewerRoute(path: string): ViewerRoute {
  if (path === "/") return { kind: "home", title: "Overview", description: "" };
  if (path === "/tokens") {
    return {
      kind: "tokens",
      title: "Tokens",
      description: "Deep teal · Space Grotesk + Fragment Mono",
    };
  }
  const group = path.split("/")[1];
  const entries = group === "components" ? components : group === "screens" ? screens : undefined;
  const entry = entries?.find((item) => path === `/${group}/${item.id}`);
  if (entry) {
    return {
      kind: "entry",
      title: entry.name,
      description: entry.description,
      group,
      entry,
    };
  }
  if (entries && path === `/${group}`) {
    return {
      kind: "index",
      title: group === "components" ? "Components" : "Screens",
      description: "",
      group,
      entries,
    };
  }
  return { kind: "missing", title: "Not found", description: "" };
}
