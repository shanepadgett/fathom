import { definePlugin } from "../sdk/mod.ts";

export default definePlugin({
  id: "fathom:rpc",
  apiVersion: 1,
  backend: {
    provides: ["rpc"],
    activate(ctx) {
      const handlers = new Map<
        string,
        (params: Record<string, unknown>) => unknown | Promise<unknown>
      >();
      ctx.provide("rpc", {
        register(name, handler) {
          if (handlers.has(name)) {
            throw new Error(`Duplicate operation ${name}`);
          }
          handlers.set(name, handler);
          return () => {
            handlers.delete(name);
          };
        },
        async invoke(name, params) {
          const handler = handlers.get(name);
          if (!handler) throw new Error(`Unknown operation: ${name}`);
          return await handler(params);
        },
      });
    },
  },
});
