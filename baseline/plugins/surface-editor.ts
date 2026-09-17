/** Editor focus. Registers the Editor surface and requires fs so the file tree can load. */
import { definePlugin } from "../sdk.ts";

export default definePlugin({
  name: "surface-editor",
  inject: ["surfaces", "fs"],
  apply(ctx) {
    ctx.effect(() => ctx.surfaces.register({ id: "editor", label: "Editor" }));
  },
});
