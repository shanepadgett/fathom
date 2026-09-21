import { Api, decode, definePlugin, Storage, T } from "@fathom/sdk";
import { CounterApi } from "../contract.ts";

export default definePlugin({
  id: "counter",
  requires: { api: Api, storage: Storage },
  config: T.Object({
    step: T.Number({ default: 1, description: "How much each click adds." }),
  }),
  start({ api, storage }, config) {
    const current = () => decode(T.Number(), storage.get("count") ?? 0);

    const publication = api.serve(CounterApi, {
      read: () => ({ count: current() }),
      increment: () => {
        const count = current() + config.step;
        storage.set("count", count);
        publication.emit("changed", { count });

        return {};
      },
    });
  },
});
