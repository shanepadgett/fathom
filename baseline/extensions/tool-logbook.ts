/** Third-party tool. Registers logbook for the model. Injects logbook, never fs. */
import type Logbook from "./logbook.ts";

import { Type } from "typebox";

import { definePlugin } from "../sdk.ts";

export default definePlugin({
  name: "tool-logbook",
  inject: ["tools", "logbook"],
  apply(ctx) {
    const logbook: Logbook = ctx.logbook;
    ctx.effect(() =>
      ctx.tools.register({
        name: "logbook",
        description:
          "Append or read the workspace logbook. Use add to record a note, read to show it.",
        parameters: Type.Object({
          action: Type.Union([Type.Literal("add"), Type.Literal("read")]),
          text: Type.Optional(Type.String()),
        }),
        async execute(args) {
          if (args.action === "read") {
            const text = await logbook.read();
            return text || "(empty logbook)";
          }
          const note = String(args.text ?? "").trim();
          if (!note) throw new Error("text is required to add a logbook entry");
          await logbook.append(note);
          return "Logged.";
        },
      }),
    );
  },
});
