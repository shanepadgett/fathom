import { ChangeSchema, CompositionSchema, decode } from "@fathom/sdk";
import { createEventBus } from "./events.ts";
import { createApiDispatch } from "./api.ts";
import { serveStatic } from "./static.ts";
import type { Kernel } from "@fathom/kernel";
import { listen } from "./transport.ts";
import type { CompositionStore } from "./composition.ts";

export function bridge(
  kernel: Kernel,
  environment: {
    resources: string;
    launchToken: string;
    /** Fixed loopback port for browser mode; omitted under the desktop runtime. */
    port?: number;
  },
  state: CompositionStore,
  catalog: () => Promise<unknown>,
) {
  const disposers: (() => void | Promise<void>)[] = [];

  const scope = {
    defer: (fn: () => void | Promise<void>) => {
      disposers.push(fn);
    },
  };

  const events = createEventBus(() => ({
    contracts: api.advertised(),
    plugins: kernel.plugins(),
  }));

  const api = createApiDispatch(kernel, events.publish);
  scope.defer(kernel.watch((status) => events.publish("kernel", status)));

  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });

  const server = listen(async (req) => {
    const url = new URL(req.url);

    if (url.host !== new URL(server.origin).host) {
      return json({ error: "Invalid host" }, 403);
    }

    if (
      req.headers.has("origin") &&
      req.headers.get("origin") !== server.origin
    ) {
      return json({ error: "Invalid origin" }, 403);
    }

    try {
      if (url.pathname.startsWith("/api/")) {
        if (
          req.headers.get("authorization") !==
          `Bearer ${environment.launchToken}`
        ) {
          return json({ error: "Unauthorized" }, 401);
        }

        if (url.pathname === "/api/events" && req.method === "GET") {
          return events.connect(req);
        }

        if (url.pathname === "/api/operations" && req.method === "GET") {
          return json(kernel.operations());
        }

        if (url.pathname === "/api/composition" && req.method === "GET") {
          return json(state.value);
        }

        if (url.pathname === "/api/composition" && req.method === "POST") {
          const input = decode(CompositionSchema, await req.json());

          await state.update(input.revision, {
            ui: input.ui,
            slots: input.slots,
          });

          return json(state.value);
        }

        if (url.pathname === "/api/ui-plugins" && req.method === "GET") {
          return json(await catalog());
        }

        // Rebuilt artifacts: the page reloads UI plugins whose URL changed.
        if (
          url.pathname === "/api/ui-plugins/refresh" &&
          req.method === "POST"
        ) {
          events.publish("ui-plugins", await catalog());

          return json({}, 202);
        }

        if (url.pathname === "/api/contracts" && req.method === "GET") {
          return json(api.advertised());
        }

        if (url.pathname === "/api/plugins" && req.method === "GET") {
          return json(kernel.plugins());
        }

        if (url.pathname === "/api/graph" && req.method === "GET") {
          return json(kernel.graph());
        }

        const control =
          /^\/api\/plugins\/([^/]+)(?:\/(enable|disable|reload|config))?$/.exec(
            url.pathname,
          );

        if (control) {
          const id = decodeURIComponent(control[1]);

          if (!control[2] && req.method === "GET") {
            return json({
              status: kernel.plugins().find((p) => p.id === id),
              node: kernel.graph().nodes.find((p) => p.id === id),
            });
          }

          if (control[2] && req.method === "POST") {
            if (!kernel.plugins().some((p) => p.id === id)) {
              return json({ error: "Unknown plugin" }, 404);
            }

            const change = decode(ChangeSchema, {
              id,
              action: control[2],
              ...(control[2] === "config" ? { config: await req.json() } : {}),
            });

            return json({ opId: kernel.submit(change) }, 202);
          }
        }

        const response = await api.dispatch(req);

        if (response) {
          return response;
        }

        return json({ error: "Not found" }, 404);
      }

      return await serveStatic(req, environment.resources);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Request failed" },
        400,
      );
    }
  }, environment.port);

  scope.defer(async () => {
    events.close();
    await server.close();
  });

  return {
    origin: server.origin,
    close: async () => {
      for (const dispose of disposers.reverse()) {
        await dispose();
      }
    },
  };
}
