import type { Loader } from "@fathom/kernel";
import {
  decode,
  type PluginDef,
  T,
  UiArtifactSchema,
  UI_RUNTIME_IMPORTS,
} from "@fathom/sdk";
import type { BrowserClient } from "./client.ts";

export class BrowserLoader implements Loader {
  artifacts = new WeakMap<PluginDef, { url: string; styles: string[] }>();
  /** Artifact URL each plugin id was loaded from; a different URL means a rebuild. */
  readonly urls = new Map<string, string>();

  constructor(
    private client: BrowserClient,
    private register: (def: PluginDef) => void,
  ) {}

  async catalog() {
    return decode(
      T.Array(UiArtifactSchema),
      await this.client.request("/api/ui-plugins"),
    );
  }

  async load(source: string) {
    const artifact = (await this.catalog()).find((a) => a.id === source);

    if (!artifact) {
      throw new Error(`No UI artifact for ${source}. Build its UI first.`);
    }

    if (!UI_RUNTIME_IMPORTS.every((id) => artifact.externals.includes(id))) {
      throw new Error("Artifact does not use host singletons");
    }

    for (const path of [artifact.url, ...artifact.styles]) {
      const url = new URL(path, location.origin);

      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith("/plugins/")
      ) {
        throw new Error("Expected host-served immutable artifact");
      }
    }

    const module = (await import(
      new URL(artifact.url, location.origin).href
    )) as {
      default: PluginDef;
    };

    if (module.default.id !== source) {
      throw new Error("UI manifest id mismatch");
    }

    this.register(module.default);
    this.artifacts.set(module.default, artifact);
    this.urls.set(source, artifact.url);

    return module;
  }

  async activate(_source: string, def: PluginDef) {
    const links: HTMLLinkElement[] = [];

    try {
      await Promise.all(
        (this.artifacts.get(def)?.styles ?? []).map(
          (href) =>
            new Promise<void>((resolve, reject) => {
              const link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = href;
              link.onload = () => resolve();
              link.onerror = () => reject(new Error(`Could not load ${href}`));
              links.push(link);
              document.head.append(link);
            }),
        ),
      );
    } catch (e) {
      links.forEach((l) => l.remove());
      throw e;
    }

    return () => links.forEach((l) => l.remove());
  }
}
