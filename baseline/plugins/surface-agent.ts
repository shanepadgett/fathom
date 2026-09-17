/** Agent focus. Registers the Agent surface. Default landing mode when mounted. */
import { definePlugin } from "../sdk.ts";

export default definePlugin({
  name: "surface-agent",
  inject: ["surfaces"],
  apply(ctx) {
    ctx.effect(() => ctx.surfaces.register({ id: "agent", label: "Agent" }));
  },
});
