/** Chat focus. Registers the Chat surface. Leave it off the host list to drop that mode. */
import { definePlugin } from "../sdk.ts";

export default definePlugin({
  name: "surface-chat",
  inject: ["surfaces"],
  apply(ctx) {
    ctx.effect(() => ctx.surfaces.register({ id: "chat", label: "Chat" }));
  },
});
