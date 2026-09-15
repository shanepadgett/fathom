import type { FileRange } from "../../sdk/editor.ts";
import type { ToolContext } from "../../sdk/mod.ts";

import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import { Type } from "typebox";

import { atomicWrite } from "../../kernel/files.ts";
import { definePlugin } from "../../sdk/mod.ts";

const alphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function version(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function anchors(text: string) {
  const lines = text.split("\n");
  if (lines.length > 200_000) {
    throw new Error(
      "File has too many lines for hashline editing; inspect a bounded slice with bash",
    );
  }
  const used = new Set<number>();
  const checksum = version(text);
  return lines.map((line, index) => {
    let value =
      createHash("sha256").update(`${checksum}:${index}`).digest().readUInt32BE(
        0,
      ) % 238328;
    while (used.has(value)) value = (value + 1) % 238328;
    used.add(value);
    return {
      hash: alphabet[Math.floor(value / 3844)] +
        alphabet[Math.floor(value / 62) % 62] + alphabet[value % 62],
      line,
    };
  });
}

export default definePlugin({
  id: "fathom:files",
  apiVersion: 1,
  backend: {
    requires: ["tools", "workspace", "events"],
    activate(ctx) {
      const registry = ctx.get("tools"),
        workspace = ctx.get("workspace"),
        events = ctx.get("events");
      const reads = new Map<string, string>();
      const emit = (
        path: string,
        context: ToolContext,
        changed: boolean,
        range?: FileRange,
      ) =>
        events.publish({
          type: "file",
          sessionId: context.sessionId,
          data: { path, changed, range },
        });
      const registrations = [
        registry.register({
          name: "read",
          description:
            "Read up to 3000 lines with three-character edit anchors. Use offset and limit to paginate. Read again after external changes.",
          readOnly: true,
          parameters: Type.Object({
            path: Type.String(),
            offset: Type.Optional(Type.Integer({ minimum: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 3000 })),
          }),
          async execute(args, context) {
            const path = await workspace.resolve(String(args.path));
            if ((await Deno.stat(path)).size > 8_000_000) {
              throw new Error(
                "File exceeds 8 MB; use a bounded command to inspect it",
              );
            }
            const text = await Deno.readTextFile(path);
            if (text.includes("\0")) {
              throw new Error("Binary file; open it in the workspace viewer");
            }
            const offset = Number(args.offset ?? 1) - 1,
              limit = Number(args.limit ?? 3000);
            const lines = anchors(text),
              selected = lines.slice(offset, offset + limit);
            reads.set(`${context.sessionId}:${path}`, version(text));
            emit(String(args.path), context, false, {
              startLine: offset + 1,
              endLine: Math.max(offset + 1, offset + selected.length),
            });
            return selected.map(({ hash, line }) => `${hash}| ${line}`).join(
              "\n",
            ).slice(0, 100_000) + (offset + limit < lines.length
              ? `\n[More lines: read offset=${offset + limit + 1}]`
              : "");
          },
        }),
        registry.register({
          name: "write",
          description:
            "Atomically create or replace a file. Existing files must first be read in this session; refuses stale writes.",
          parameters: Type.Object({
            path: Type.String(),
            content: Type.String({ maxLength: 2_000_000 }),
          }),
          async execute(args, context) {
            const path = await workspace.resolve(String(args.path), true);
            let mode = 0o644;
            try {
              const text = await Deno.readTextFile(path);
              if (reads.get(`${context.sessionId}:${path}`) !== version(text)) {
                throw new Error(
                  "File changed or has not been read; read it before overwriting",
                );
              }
              mode = (await stat(path)).mode & 0o777;
            } catch (error) {
              if (!(error instanceof Deno.errors.NotFound)) throw error;
            }
            context.signal.throwIfAborted();
            await atomicWrite(path, String(args.content), mode);
            reads.set(
              `${context.sessionId}:${path}`,
              version(String(args.content)),
            );
            emit(String(args.path), context, true, {
              startLine: 1,
              endLine: Math.max(1, String(args.content).split("\n").length),
            });
            return `Saved ${args.path}`;
          },
        }),
        registry.register({
          name: "edit",
          description:
            "Edit the last-read file using replace, insert_before, insert_after, or delete with hash anchors. Refuses changes if the file has changed since read.",
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
          async execute(args, context) {
            const path = await workspace.resolve(String(args.path), true);
            const text = await Deno.readTextFile(path);
            if (reads.get(`${context.sessionId}:${path}`) !== version(text)) {
              throw new Error("File changed since last read; read it again");
            }
            const lines = anchors(text);
            const start = lines.findIndex((line) =>
                line.hash === args.start_hash
              ),
              end = args.end_hash
                ? lines.findIndex((line) => line.hash === args.end_hash)
                : start;
            if (start < 0 || end < start) {
              throw new Error("Invalid or stale anchors");
            }
            const values = lines.map((line) => line.line);
            const added = args.content === undefined || args.content === ""
              ? []
              : String(args.content).split("\n");
            if (args.operation === "insert_before") {
              values.splice(start, 0, ...added);
            } else if (args.operation === "insert_after") {
              values.splice(start + 1, 0, ...added);
            } else {values.splice(
                start,
                end - start + 1,
                ...(args.operation === "delete" ? [] : added),
              );}
            context.signal.throwIfAborted();
            const next = values.join("\n");
            await atomicWrite(path, next, (await stat(path)).mode & 0o777);
            reads.set(`${context.sessionId}:${path}`, version(next));
            const firstLine = start +
              (args.operation === "insert_after" ? 2 : 1);
            emit(String(args.path), context, true, {
              startLine: firstLine,
              endLine: firstLine + Math.max(0, added.length - 1),
            });
            return `Updated ${args.path}. Read again for new anchors.`;
          },
        }),
      ];
      ctx.effect(() => () => {
        for (const dispose of registrations) dispose();
      });
    },
  },
});
