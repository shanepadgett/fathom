/** read, write, edit for the model. Hashline anchors live here, not on disk. Swap this to change the protocol. */
import { createHash } from "node:crypto";

import { Type } from "typebox";

import { definePlugin } from "../sdk.ts";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function checksum(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function anchors(text: string) {
  const lines = text.split("\n");
  const used = new Set<number>();
  const digest = checksum(text);
  return lines.map((line, index) => {
    let value = createHash("sha256").update(`${digest}:${index}`).digest().readUInt32BE(0) % 238328;
    while (used.has(value)) value = (value + 1) % 238328;
    used.add(value);
    return {
      hash:
        alphabet[Math.floor(value / 3844)] +
        alphabet[Math.floor(value / 62) % 62] +
        alphabet[value % 62],
      line,
    };
  });
}

export default definePlugin({
  name: "tool-fs",
  inject: ["tools", "fs"],
  apply(ctx) {
    const reads = new Map<string, string>();
    const remember = (sessionId: string, path: string, text: string) => {
      reads.set(`${sessionId}:${path}`, checksum(text));
    };
    const matches = (sessionId: string, path: string, text: string) =>
      reads.get(`${sessionId}:${path}`) === checksum(text);

    ctx.effect(() => {
      const stop = [
        ctx.tools.register({
          name: "read",
          description:
            "Read up to 3000 lines with three-character edit anchors. Use offset and limit to paginate. Read again after external changes.",
          parameters: Type.Object({
            path: Type.String(),
            offset: Type.Optional(Type.Integer({ minimum: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 3000 })),
          }),
          async execute(args, cycle) {
            const path = String(args.path);
            const text = await ctx.fs.readText(path);
            const offset = Number(args.offset ?? 1) - 1;
            const limit = Number(args.limit ?? 3000);
            const lines = anchors(text);
            const selected = lines.slice(offset, offset + limit);
            remember(cycle.sessionId, path, text);
            const body = selected.map(({ hash, line }) => `${hash}| ${line}`).join("\n");
            return offset + limit < lines.length
              ? `${body}\n[More lines: read offset=${offset + limit + 1}]`
              : body;
          },
        }),
        ctx.tools.register({
          name: "write",
          description:
            "Atomically create or replace a file. Existing files must first be read in this session.",
          parameters: Type.Object({
            path: Type.String(),
            content: Type.String({ maxLength: 2_000_000 }),
          }),
          async execute(args, cycle) {
            const path = String(args.path);
            const content = String(args.content);
            if (await ctx.fs.exists(path)) {
              const text = await ctx.fs.readText(path);
              if (!matches(cycle.sessionId, path, text)) {
                throw new Error("File changed or has not been read; read it before overwriting");
              }
            }
            cycle.signal.throwIfAborted();
            await ctx.fs.replace(path, content);
            remember(cycle.sessionId, path, content);
            return `Saved ${path}`;
          },
        }),
        ctx.tools.register({
          name: "edit",
          description:
            "Edit the last-read file using replace, insert_before, insert_after, or delete with hash anchors.",
          parameters: Type.Object({
            path: Type.String(),
            operation: Type.Union([
              Type.Literal("replace"),
              Type.Literal("insert_before"),
              Type.Literal("insert_after"),
              Type.Literal("delete"),
            ]),
            start_hash: Type.String(),
            end_hash: Type.Optional(Type.String()),
            content: Type.Optional(Type.String()),
          }),
          async execute(args, cycle) {
            const path = String(args.path);
            const text = await ctx.fs.readText(path);
            if (!matches(cycle.sessionId, path, text)) {
              throw new Error("File changed since last read; read it again");
            }
            const lines = anchors(text);
            const start = lines.findIndex((line) => line.hash === args.start_hash);
            const end = args.end_hash
              ? lines.findIndex((line) => line.hash === args.end_hash)
              : start;
            if (start < 0 || end < start) {
              throw new Error("Invalid or stale anchors");
            }
            const values = lines.map((line) => line.line);
            const added =
              args.content === undefined || args.content === ""
                ? []
                : String(args.content).split("\n");
            if (args.operation === "insert_before") {
              values.splice(start, 0, ...added);
            } else if (args.operation === "insert_after") {
              values.splice(start + 1, 0, ...added);
            } else {
              values.splice(start, end - start + 1, ...(args.operation === "delete" ? [] : added));
            }
            cycle.signal.throwIfAborted();
            const next = values.join("\n");
            await ctx.fs.replace(path, next);
            remember(cycle.sessionId, path, next);
            return `Updated ${path}. Read again for new anchors.`;
          },
        }),
      ];
      return () => {
        for (const dispose of stop) dispose();
      };
    });
  },
});
