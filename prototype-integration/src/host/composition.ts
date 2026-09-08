import type { HarnessPlugin } from "../kernel/plugin.ts";

import { basename, dirname } from "node:path";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import workbench from "../integration/workbench.ts";
import context from "../plugins/context-default.ts";
import desktop from "../plugins/desktop-window.ts";
import { piPlugin } from "../plugins/model-pi/index.ts";
import agent from "../plugins/runtime-agent/index.ts";
import echo from "../plugins/runtime-echo.ts";
import sessions from "../plugins/session-memory.ts";
import bash from "../plugins/tools/bash.ts";
import edit from "../plugins/tools/edit.ts";
import read from "../plugins/tools/read.ts";
import registry from "../plugins/tools/registry.ts";
import write from "../plugins/tools/write.ts";
import { workspacePlugin } from "../plugins/workspace-local.ts";
import { type AppConfig, appRoot, readComposition } from "./config.ts";
export async function compose(config: AppConfig) {
  const builtin = new Map<string, HarnessPlugin>(
    [
      desktop,
      workbench,
      context,
      sessions,
      registry,
      read,
      write,
      edit,
      bash,
      agent,
      echo,
      piPlugin(config.authPath, config.model),
      workspacePlugin(config.workspace),
    ].map((p) => [p.id, p]),
  );
  let base = appRoot;
  let composition = {
    plugins: [
      "desktop-window",
      "session-memory",
      "workspace-local",
      "tool-registry",
      "tool-read",
      "tool-write",
      "tool-edit",
      "tool-bash",
      "integration-workbench",
      "model-pi",
      "context-default",
      config.profile === "echo" ? "runtime-echo" : "runtime-agent",
    ],
    uiPlugins: [
      "/ui/plugins/viewport-scale.js",
      "/ui/plugins/conversation.js",
      "/ui/plugins/composition.js",
      "/ui/plugins/workbench.js",
      "/ui/plugins/shell.js",
    ],
  };
  if (config.composition) {
    ({ composition, base } = await readComposition(config.composition));
  }
  const plugins: HarnessPlugin[] = [];
  for (const entry of composition.plugins) {
    const known = builtin.get(entry);
    if (known) {
      plugins.push(known);
      continue;
    }
    const url = entry.startsWith("file:") ? entry : pathToFileURL(resolve(base, entry)).href;
    const module = await import(url);
    if (!module.default || typeof module.default.activate !== "function") {
      throw new Error(`Invalid plugin module: ${entry}`);
    }
    plugins.push(module.default);
  }
  const assets = new Map<string, string>();
  const uiPlugins = composition.uiPlugins.map((entry, index) => {
    if (entry.startsWith("/ui/")) return entry;
    const file = resolve(base, entry);
    const prefix = `/extensions/${index}/`;
    assets.set(prefix, dirname(file));
    return prefix + basename(file);
  });
  return { plugins, uiPlugins, assets };
}
