import type { Application } from "./application.ts";

import { timingSafeEqual } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

import { MAX_RPC_BUFFER_BYTES, MAX_RPC_REQUEST_BYTES } from "../sdk/transport.ts";
import { artifactPreview } from "./artifact-preview.ts";
import { mediaResponse, mediaUpload } from "./media.ts";

const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

function equal(a: string, b: string) {
  const x = new TextEncoder().encode(a),
    y = new TextEncoder().encode(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function handler(
  app: Application,
  token: string,
  getOrigin: () => string,
  publicDir: string,
) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws:; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  };
  return async (request: Request): Promise<Response> => {
    const origin = getOrigin();
    const url = new URL(request.url);
    if (url.origin !== origin) {
      return new Response("Invalid host", { status: 403 });
    }
    const source = request.headers.get("origin");
    if (source && source !== origin) {
      return new Response("Invalid origin", { status: 403 });
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return new Response("Cross-site request denied", { status: 403 });
    }
    if (url.pathname === "/bootstrap" && request.method === "POST") {
      return Response.json(
        { projects: app.projects.list() },
        {
          headers: {
            ...headers,
            "Set-Cookie": `fathom=${token}; HttpOnly; SameSite=Strict; Path=/`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const cookie =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((value) => value.trim())
        .find((value) => value.startsWith("fathom="))
        ?.slice(7) ?? "";
    const authorized =
      equal(cookie, token) ||
      equal(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", token);
    if (url.pathname === "/ws") {
      if (!authorized || request.headers.get("upgrade")?.toLowerCase() !== "websocket")
        return new Response("Unauthorized", { status: 401 });
      const { socket, response } = Deno.upgradeWebSocket(request);
      const send = (value: unknown) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount >= MAX_RPC_BUFFER_BYTES) {
          socket.close(1013, "Connection is too slow; reconnect to refresh state");
          return;
        }
        socket.send(JSON.stringify(value));
      };
      const listener = (event: unknown) => send({ event });
      socket.onopen = () => app.listeners.add(listener);
      socket.onclose = () => app.listeners.delete(listener);
      socket.onerror = () => app.listeners.delete(listener);
      socket.onmessage = async (event) => {
        if (
          typeof event.data !== "string" ||
          event.data.length > MAX_RPC_REQUEST_BYTES ||
          new TextEncoder().encode(event.data).byteLength > MAX_RPC_REQUEST_BYTES
        ) {
          socket.close(1009, "Message too large");
          return;
        }
        let id: unknown;
        try {
          const message = JSON.parse(event.data);
          id = message.id;
          if (
            typeof id !== "string" ||
            typeof message.method !== "string" ||
            (message.params &&
              (typeof message.params !== "object" || Array.isArray(message.params)))
          )
            throw new Error("Invalid request");
          const result =
            message.method === "ping"
              ? { time: Date.now() }
              : await app.request(message.method, message.params);
          send({ id, result });
        } catch (error) {
          send({
            id,
            error: error instanceof Error ? error.message : "Request failed",
          });
        }
      };
      return response;
    }
    if (url.pathname === "/artifact-preview") {
      if (!authorized) return new Response("Unauthorized", { status: 401 });
      try {
        return await artifactPreview(request, app, origin);
      } catch {
        return new Response("Artifact unavailable", { status: 404 });
      }
    }
    if (url.pathname.startsWith("/media/")) {
      if (!authorized) return new Response("Unauthorized", { status: 401 });
      const parts = url.pathname.split("/");
      if (parts.length !== 5) {
        return new Response("Invalid media path", { status: 400 });
      }
      try {
        const [, , projectId, sessionId, id] = parts.map(decodeURIComponent);
        const environment = app.environments.get(projectId);
        if (!environment) {
          return new Response("Project not open", { status: 404 });
        }
        await environment.whenReady();
        if (id === "upload" && request.method === "POST") {
          return await mediaUpload(request, environment.host.get("media"), sessionId);
        }
        return await mediaResponse(request, environment.host.get("media"), sessionId, id);
      } catch {
        return new Response("Media unavailable", { status: 404 });
      }
    }
    if (url.pathname.startsWith("/extensions/")) {
      if (!authorized) return new Response("Unauthorized", { status: 401 });
      const [, , projectId, encodedId, ...parts] = url.pathname.split("/");
      const entry = app.environments
        .get(projectId)
        ?.assets.get(decodeURIComponent(encodedId ?? ""));
      if (!entry) return new Response("Extension not found", { status: 404 });
      const root = await Deno.realPath(dirname(entry));
      let file: string;
      try {
        file = await Deno.realPath(resolve(root, ...parts.map(decodeURIComponent)));
      } catch {
        return new Response("Extension file not found", { status: 404 });
      }
      const rel = relative(root, file);
      if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
        return new Response("Invalid extension path", { status: 403 });
      }
      if (!mime[extname(file)]) {
        return new Response("Unsupported extension asset", { status: 404 });
      }
      return new Response(await Deno.readFile(file), {
        headers: {
          ...headers,
          "Content-Type": mime[extname(file)],
          "Cache-Control": "no-store",
        },
      });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    const path = decodeURIComponent(url.pathname);
    if (path.split("/").includes("..") || path.includes("\\") || path.includes("\0"))
      return new Response("Invalid path", { status: 400 });
    try {
      const file = join(publicDir, path === "/" ? "index.html" : path);
      return new Response(await Deno.readFile(file), {
        headers: {
          ...headers,
          "Content-Type": mime[extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
}
