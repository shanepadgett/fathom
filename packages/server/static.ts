import { extname, resolve, sep } from "node:path";

export async function serveStatic(req: Request, resources: string) {
  const url = new URL(req.url);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  for (const mount of [
    { prefix: "/plugins/", dir: `${resources}/dist/plugins`, immutable: true },
    { prefix: "/", dir: `${resources}/dist/app`, immutable: false },
  ]) {
    if (!url.pathname.startsWith(mount.prefix)) {
      continue;
    }

    const relative =
      decodeURIComponent(url.pathname.slice(mount.prefix.length)) ||
      "index.html";

    const root = await Deno.realPath(mount.dir);
    const path = resolve(root, relative);

    if (path !== root && !path.startsWith(root + sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    let real: string;

    try {
      real = await Deno.realPath(path);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        continue;
      }

      throw e;
    }

    if (!real.startsWith(root + sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };

    const bytes = await Deno.readFile(real);

    return new Response(req.method === "HEAD" ? null : bytes, {
      headers: {
        "content-type": types[extname(real)] ?? "application/octet-stream",
        "cache-control": mount.immutable
          ? "public, max-age=31536000, immutable"
          : "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
      },
    });
  }

  return new Response("Not found", { status: 404 });
}
