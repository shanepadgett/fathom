import type { PluginContext } from "./sdk.ts";

type Api = PluginContext<"sessions" | "agent" | "model" | "surfaces" | "fs">;

/** Product HTTP. The serve plugin owns the port and static files. */
export async function handleApi(ctx: Api, request: Request, url: URL) {
  if (request.method === "GET" && url.pathname === "/api/surfaces") {
    return json(ctx.surfaces.list());
  }
  if (request.method === "GET" && url.pathname === "/api/models") {
    return json(await ctx.model.available());
  }
  if (request.method === "GET" && url.pathname === "/api/workspace/tree") {
    return json(await ctx.fs.tree());
  }
  if (request.method === "GET" && url.pathname === "/api/workspace/file") {
    const path = url.searchParams.get("path") ?? "";
    if (!path) throw new Error("Path is empty");
    return json({ path, text: await ctx.fs.readText(path) });
  }
  if (request.method === "GET" && url.pathname === "/api/sessions") {
    return json(ctx.sessions.list());
  }
  if (request.method === "POST" && url.pathname === "/api/sessions") {
    const body = await request.json().catch(() => ({}));
    return json(ctx.sessions.create(body));
  }
  const live = /^\/api\/sessions\/([^/]+)\/live$/.exec(url.pathname);
  if (request.method === "GET" && live) {
    return stream(ctx, live[1]);
  }
  const messages = /^\/api\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
  if (request.method === "POST" && messages) {
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text) throw new Error("Message is empty");
    void ctx.agent.submit(messages[1], text);
    return json(ctx.sessions.snapshot(messages[1]));
  }
  const stop = /^\/api\/sessions\/([^/]+)\/stop$/.exec(url.pathname);
  if (request.method === "POST" && stop) {
    ctx.agent.stop(stop[1]);
    return json({ ok: true });
  }
  const one = /^\/api\/sessions\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && one) {
    return json(ctx.sessions.snapshot(one[1]));
  }
  if (request.method === "PATCH" && one) {
    const body = await request.json();
    return json(
      ctx.sessions.update(one[1], {
        provider: String(body.provider ?? ""),
        model: String(body.model ?? ""),
      }),
    );
  }
  return json({ error: "Not found" }, 404);
}

function stream(ctx: Api, id: string) {
  ctx.sessions.get(id);
  let drop: (() => boolean) | undefined;
  const body = new ReadableStream({
    start(controller) {
      const send = () => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(ctx.sessions.snapshot(id))}\n\n`),
        );
      };
      send();
      drop = ctx.on("session/changed", (changed) => {
        if (changed === id) send();
      });
    },
    cancel() {
      drop?.();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}
