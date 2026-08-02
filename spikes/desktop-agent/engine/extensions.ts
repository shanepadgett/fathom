import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ExtensionSummary } from "../protocol.ts";
import type { SessionRepository } from "./database.ts";

interface Manifest {
  id: string;
  name: string;
  description?: string;
  backend?: string;
  renderer?: string;
}

export interface ExtensionCommand {
  name: string;
  description: string;
  run(argumentsText: string): Promise<string> | string;
}

export interface LoadedExtensions {
  tools: AgentTool[];
  commands: ExtensionCommand[];
  summaries: ExtensionSummary[];
  dispose(): Promise<void>;
}

export async function loadExtensions(
  workspace: string,
  repository: SessionRepository,
  generation: number,
): Promise<LoadedExtensions> {
  const root = join(workspace, ".fathom", "extensions");
  const tools: AgentTool[] = [];
  const commands: ExtensionCommand[] = [];
  const summaries: ExtensionSummary[] = [];
  const disposers: (() => void | Promise<void>)[] = [];
  let directories: string[] = [];
  try {
    for await (const entry of Deno.readDir(root)) {
      if (entry.isDirectory) directories.push(entry.name);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  directories = directories.sort();
  for (const directory of directories) {
    const manifestPath = join(root, directory, "manifest.json");
    let manifest: Manifest | undefined;
    try {
      const loadedManifest = validateManifest(JSON.parse(await Deno.readTextFile(manifestPath)));
      manifest = loadedManifest;
      if (summaries.some((entry) => entry.id === loadedManifest.id)) {
        throw new Error(`Duplicate extension id ${loadedManifest.id}`);
      }
      const enabled = repository.extensionEnabled(loadedManifest.id) ?? true;
      const summary: ExtensionSummary = {
        id: loadedManifest.id,
        name: loadedManifest.name,
        description: loadedManifest.description,
        enabled,
        active: false,
      };
      summaries.push(summary);
      if (!enabled) continue;

      if (loadedManifest.backend) {
        const moduleUrl = pathToFileURL(join(root, directory, loadedManifest.backend));
        moduleUrl.searchParams.set("generation", String(generation));
        const module = await import(moduleUrl.href) as {
          activate?: (
            api: unknown,
          ) => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>;
        };
        if (typeof module.activate !== "function") {
          throw new Error("Backend entry must export activate()");
        }
        const dispose = await module.activate({
          Type,
          workspace,
          registerTool(tool: AgentTool) {
            if (tools.some((entry) => entry.name === tool.name)) {
              throw new Error(`Duplicate tool ${tool.name}`);
            }
            tools.push(tool);
          },
          registerCommand(command: ExtensionCommand) {
            if (commands.some((entry) => entry.name === command.name)) {
              throw new Error(`Duplicate command ${command.name}`);
            }
            commands.push(command);
          },
        });
        if (typeof dispose === "function") disposers.push(dispose);
      }
      if (loadedManifest.renderer) {
        const path = relative(workspace, join(root, directory, loadedManifest.renderer));
        summary.rendererEntry = `/__workspace__/${
          path.split("/").map(encodeURIComponent).join("/")
        }?generation=${generation}`;
      }
      summary.active = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (manifest) {
        const existing = summaries.find((entry) => entry.id === manifest?.id);
        if (existing) existing.error = message;
        else {summaries.push({
            id: manifest.id,
            name: manifest.name,
            enabled: true,
            active: false,
            error: message,
          });}
      } else {
        summaries.push({
          id: directory,
          name: directory,
          enabled: true,
          active: false,
          error: message,
        });
      }
    }
  }

  return {
    tools,
    commands,
    summaries,
    async dispose() {
      for (const dispose of disposers.reverse()) await dispose();
    },
  };
}

function validateManifest(value: unknown): Manifest {
  if (!value || typeof value !== "object") throw new Error("Manifest must be an object");
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || !/^[a-z0-9][a-z0-9.-]+$/.test(input.id)) {
    throw new Error("Manifest id is invalid");
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new Error("Manifest name is required");
  }
  for (const field of ["description", "backend", "renderer"] as const) {
    if (input[field] !== undefined && typeof input[field] !== "string") {
      throw new Error(`${field} must be a string`);
    }
  }
  return input as unknown as Manifest;
}
