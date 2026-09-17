/** HTTP port, static files, and the product API. Injects the services the routes call. */
import { extname, join, resolve } from "@std/path";

import { handleApi } from "./routes.ts";
import { type PluginContext, definePlugin } from "./sdk.ts";

export interface HttpConfig {
  port: number;
  publicDir: string;
}

type HttpCtx = PluginContext<"sessions" | "agent" | "model" | "surfaces" | "fs">;

export default definePlugin({
  name: "http",
  inject: ["sessions", "agent", "model", "surfaces", "fs"],
  apply(ctx, config: HttpConfig) {
    const desktop = Deno.env.get("DENO_SERVE_ADDRESS");
    const port = desktop ? Number(desktop.split(":").pop()) : config.port;
    const server = Deno.serve({ hostname: "127.0.0.1", port }, (request) =>
      handle(ctx, config.publicDir, request),
    );
    ctx.effect(() => () => server.shutdown());
    const addr = server.addr as Deno.NetAddr;
    console.log(`Fathom baseline is ready at http://127.0.0.1:${addr.port}`);
  },
});

async function handle(ctx: HttpCtx, publicDir: string, request: Request) {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(ctx, request, url);
    }
    return await asset(publicDir, url.pathname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Session not found" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

async function asset(publicDir: string, pathname: string) {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const root = resolve(publicDir);
  const path = resolve(root, decodeURIComponent(relative).replace(/^\//, ""));
  if (!path.startsWith(root + "/") && path !== join(root, "index.html")) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const file = await Deno.readFile(path);
    return new Response(file, { headers: { "content-type": media(path) } });
  } catch {
    if (extname(pathname)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const file = await Deno.readFile(join(publicDir, "index.html"));
    return new Response(file, { headers: { "content-type": "text/html" } });
  }
}

function media(path: string) {
  switch (extname(path)) {
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".css":
      return "text/css";
    case ".svg":
      return "image/svg+xml";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}
