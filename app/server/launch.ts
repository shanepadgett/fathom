import { createHash } from "node:crypto";
import { join } from "node:path";

import { atomicWrite, readJson } from "../kernel/files.ts";

const PATH_KEYS = ["FATHOM_HOME", "FATHOM_WORKSPACE", "FATHOM_DENO", "FATHOM_PI_AUTH"] as const;

/** Persist paths, never tokens or arbitrary environment variables, per desktop executable. */
export async function restoreDesktopLaunch(): Promise<boolean> {
  const native =
    typeof (Deno as typeof Deno & { BrowserWindow?: unknown }).BrowserWindow === "function";
  if (!native) return false;
  const userHome = Deno.env.get("HOME");
  if (!userHome || Deno.build.os !== "darwin") return true;
  const id = createHash("sha256").update(Deno.execPath()).digest("hex").slice(0, 24);
  const path = join(userHome, "Library", "Application Support", "Fathom", "launches", `${id}.json`);
  try {
    const raw = await readJson<unknown>(path, {});
    const saved =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const explicitHome = Deno.env.get("FATHOM_HOME");
    // A deliberate profile change must not inherit the previous profile's workspace/auth path.
    const sameProfile = explicitHome === undefined || explicitHome === saved.FATHOM_HOME;
    const next: Record<string, string> = {};
    for (const key of PATH_KEYS) {
      const explicit = Deno.env.get(key);
      const value =
        explicit ?? (sameProfile && typeof saved[key] === "string" ? saved[key] : undefined);
      if (typeof value !== "string" || !value) continue;
      next[key] = value;
      if (explicit === undefined) Deno.env.set(key, value);
    }
    if (Object.keys(next).length) {
      await atomicWrite(path, JSON.stringify(next, null, 2));
    }
  } catch (error) {
    // A damaged development preference must not prevent project selection or startup.
    console.error("Desktop launch paths could not be restored:", error);
  }
  return true;
}
