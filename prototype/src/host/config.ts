import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export interface Composition {
  plugins: string[];
  uiPlugins: string[];
}
export interface AppConfig {
  workspace: string;
  authPath: string;
  model: string;
  profile: string;
  port: number;
  composition?: string;
}
export const appRoot = fileURLToPath(new URL("../../", import.meta.url));
export function readConfig(): AppConfig {
  const home = Deno.env.get("HOME") ?? Deno.cwd();
  return {
    workspace: resolve(Deno.env.get("FATHOM_WORKSPACE") ?? Deno.cwd()),
    authPath: Deno.env.get("FATHOM_PI_AUTH") ?? resolve(home, ".pi/agent/auth.json"),
    model: Deno.env.get("FATHOM_MODEL") ?? "gpt-5.6-luna",
    profile: Deno.env.get("FATHOM_PROFILE") ?? "default",
    port: Number(Deno.env.get("FATHOM_PORT") ?? 4317),
    composition: Deno.env.get("FATHOM_COMPOSITION"),
  };
}
export async function readComposition(
  path: string,
): Promise<{ composition: Composition; base: string }> {
  const data = JSON.parse(await Deno.readTextFile(path));
  if (!Array.isArray(data.plugins) || !data.plugins.every((v: unknown) => typeof v === "string")) {
    throw new Error("composition.plugins must be an array of module paths or built-in IDs");
  }
  if (
    !Array.isArray(data.uiPlugins) ||
    !data.uiPlugins.every((v: unknown) => typeof v === "string")
  )
    throw new Error("composition.uiPlugins must be an array of module URLs");
  return { composition: data, base: dirname(resolve(path)) };
}
