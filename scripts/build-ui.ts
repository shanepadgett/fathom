import { discover } from "@fathom/server";
import * as esbuild from "esbuild";
import { resolve } from "node:path";
import { buildApp } from "./bundling/build-app.ts";

const root = resolve(import.meta.dirname!, "..");

const home = resolve(
  Deno.env.get("FATHOM_HOME") ?? `${Deno.env.get("HOME")}/.fathom`,
);

try {
  const artifacts = await buildApp(root, await discover(root, home));
  console.log(`Built app and ${artifacts.length} UI plugins.`);
} finally {
  esbuild.stop();
}
