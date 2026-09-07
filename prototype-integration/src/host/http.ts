import { extname } from "node:path";
import { BusyError, type Controller } from "./controller.ts";
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};
export function createHandler(controller: Controller, shutdown?: AbortSignal) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    try {
      if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
        return new Response("Local host only", { status: 403 });
      }
      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        return Response.json(controller.bootstrap());
      }
      if (request.method === "GET" && url.pathname === "/api/workbench") {
        return Response.json(await controller.workbenchState());
      }
      if (request.method === "GET" && url.pathname === "/api/events") {
        let dispose = () => {};
        const stream = new ReadableStream<Uint8Array>({
          start(output) {
            const send = (data: unknown) =>
              output.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            const unsubscribe = controller.subscribe(send);
            const heartbeat = setInterval(
              () => output.enqueue(new TextEncoder().encode(": heartbeat\n\n")),
              15_000,
            );
            const close = () => {
              dispose();
              try {
                output.close();
              } catch { /* Already closed. */ }
            };
            dispose = () => {
              unsubscribe();
              clearInterval(heartbeat);
              request.signal.removeEventListener("abort", close);
              shutdown?.removeEventListener("abort", close);
            };
            request.signal.addEventListener("abort", close, { once: true });
            shutdown?.addEventListener("abort", close, { once: true });
            send({ type: "snapshot", session: controller.bootstrap().session });
          },
          cancel() {
            dispose();
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "connection": "keep-alive",
          },
        });
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/")) {
        // The browser transport accepts same-origin JSON requests only.
        if (
          request.headers.get("origin") &&
          request.headers.get("origin") !== url.origin
        ) return new Response("Origin mismatch", { status: 403 });
        if (
          !request.headers.get("content-type")?.includes("application/json")
        ) return new Response("Expected JSON", { status: 415 });
        const body = await request.json();
        switch (url.pathname) {
          case "/api/workbench":
            return Response.json(
              await controller.workbenchCommand(body.action, body.args ?? {}),
            );
          case "/api/message":
            if (typeof body.text !== "string") {
              throw new Error("text must be a string");
            }
            controller.send(body.text);
            return Response.json({ ok: true }, { status: 202 });
          case "/api/cancel":
            controller.cancel();
            break;
          case "/api/reset":
            controller.reset();
            break;
          case "/api/profile":
            await controller.switchProfile(body.profile);
            break;
          default:
            return new Response("Not found", { status: 404 });
        }
        return Response.json({ ok: true });
      }
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      const path = url.pathname === "/"
        ? "/ui/index.html"
        : decodeURIComponent(url.pathname);
      const external = controller.asset(path);
      if (external) {
        return new Response(await Deno.readFile(external), {
          headers: {
            "content-type": types[extname(path)] ?? "application/octet-stream",
            "cache-control": "no-store",
          },
        });
      }
      if (!path.startsWith("/ui/") || path.includes("..")) {
        return new Response("Not found", { status: 404 });
      }
      const file = new URL(`../..${path}`, import.meta.url);
      return new Response(await Deno.readFile(file), {
        headers: {
          "content-type": types[extname(path)] ?? "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return new Response("Not found", { status: 404 });
      }
      return Response.json({
        error: error instanceof Error ? error.message : String(error),
      }, { status: error instanceof BusyError ? 409 : 400 });
    }
  };
}
