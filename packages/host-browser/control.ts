import {
  decode,
  GraphSchema,
  type KernelControlApi,
  OperationStatusSchema,
  PluginStatusSchema,
  T,
} from "@fathom/sdk";
import type { Kernel } from "@fathom/kernel";
import type { BrowserClient } from "./client.ts";

export function createControl(
  client: BrowserClient,
  local: Kernel,
  reconcile: () => Promise<void>,
): KernelControlApi {
  const plugins = async () => [
    ...decode(
      T.Array(PluginStatusSchema),
      await client.request("/api/plugins"),
    ),
    ...local.plugins(),
  ];

  return {
    plugins,

    async operations() {
      return [
        ...decode(
          T.Array(OperationStatusSchema),
          await client.request("/api/operations"),
        ),
        ...local.operations(),
      ];
    },

    async graph() {
      const remote = decode(GraphSchema, await client.request("/api/graph"));
      const graph = local.graph();

      return {
        nodes: [...remote.nodes, ...graph.nodes],
        edges: [...remote.edges, ...graph.edges],
      };
    },

    async submit(change) {
      if (change.host === "ui") {
        const id = local.submit(change);

        void local
          .settled()
          .then(reconcile)
          .catch((error) => {
            console.error("Could not reconcile UI API availability", error);
          });

        return id;
      }

      const response = await client.request(
        `/api/plugins/${encodeURIComponent(change.id)}/${change.action}`,
        change.action === "config" ? change.config : {},
      );

      return decode(T.Object({ opId: T.String() }), response).opId;
    },

    watch(listener) {
      let live = true;
      let revision = 0;

      const update = () => {
        const current = ++revision;

        void plugins()
          .then((status) => {
            if (live && current === revision) {
              listener(status);
            }
          })
          .catch(() => {
            if (live && current === revision) {
              listener(local.plugins());
            }
          });
      };

      const unsubscribeRemote = client.subscribe("kernel", update);
      const unsubscribeReset = client.onReset(update);
      const unsubscribeLocal = local.watch(update);

      return () => {
        live = false;
        void unsubscribeRemote();
        void unsubscribeReset();
        void unsubscribeLocal();
      };
    },
  };
}
