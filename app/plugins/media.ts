import type { MediaAsset, MediaService } from "../sdk/media.ts";

import { basename, extname, join } from "node:path";

import { Type } from "typebox";

import { assertNewFile, atomicCreate, atomicWrite } from "../kernel/files.ts";
import { definePlugin } from "../sdk/mod.ts";
import { mediaReference } from "./media-reference.ts";

const maxBytes = 64 * 1024 * 1024;
const formats = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["audio/mpeg", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/ogg", ".ogg"],
  ["audio/mp4", ".m4a"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
]);

async function readMedia(path: string, signal?: AbortSignal) {
  using file = await Deno.open(path, { read: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    signal?.throwIfAborted();
    const chunk = new Uint8Array(64 * 1024);
    const count = await file.read(chunk);
    if (count === null) break;
    size += count;
    if (size > maxBytes) throw new Error("Media exceeds 64 MiB");
    chunks.push(chunk.subarray(0, count));
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

export const media = definePlugin({
  id: "fathom:media",
  apiVersion: 1,
  backend: {
    requires: ["storage", "workspace", "tools", "context", "events", "rpc"],
    provides: ["media"],
    activate(ctx) {
      const storage = ctx.get("storage");
      const workspace = ctx.get("workspace");
      const directory = join(workspace.dataDir, "media");
      const path = (asset: MediaAsset) => {
        const extension = formats.get(asset.mime);
        if (!extension || !/^[a-f0-9-]{36}$/.test(asset.id)) {
          throw new Error("Invalid media reference");
        }
        return join(directory, `${asset.id}${extension}`);
      };
      async function persist(
        sessionId: string,
        input: { name: string; mime: string; data: Uint8Array },
        mode: "entry" | "draft" | "cache",
      ) {
        storage.getSession(sessionId);
        if (!formats.has(input.mime)) {
          throw new Error("Unsupported media format");
        }
        if (
          !(input.data instanceof Uint8Array) ||
          !input.data.byteLength ||
          input.data.byteLength > maxBytes
        ) {
          throw new Error("Media must contain between 1 byte and 64 MiB");
        }
        if (
          mode !== "entry" &&
          input.mime.startsWith("image/") &&
          input.data.byteLength > 8 * 1024 * 1024
        ) {
          throw new Error("Chat image attachments must be no larger than 8 MiB");
        }
        const name = basename(input.name)
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .trim()
          .slice(0, 200);
        if (!name) throw new Error("Media needs a filename");
        const asset: MediaAsset = {
          id: crypto.randomUUID(),
          sessionId,
          name,
          mime: input.mime,
          bytes: input.data.byteLength,
          createdAt: Date.now(),
        };
        await atomicWrite(path(asset), input.data);
        if (mode === "cache") return asset;
        try {
          storage.transaction(() => {
            if (mode === "draft") {
              const draft = service.draft(sessionId);
              if (draft.length >= 4) {
                throw new Error("Attach at most four media files per draft");
              }
              storage.setSetting(`media.draft:${sessionId}`, [...draft, asset]);
            } else {
              storage.append(sessionId, {
                kind: "custom",
                status: "completed",
                custom: { type: "media", data: asset },
              });
            }
          });
        } catch (error) {
          await Deno.remove(path(asset));
          throw error;
        }
        ctx.get("events").publish({
          type: mode === "draft" ? "media-draft" : "session",
          sessionId,
        });
        return asset;
      }
      const service: MediaService = {
        list(sessionId) {
          storage.getSession(sessionId);
          return storage
            .entries(sessionId)
            .flatMap((entry) => [
              ...(entry.custom?.type === "media" ? [entry.custom.data as MediaAsset] : []),
              ...(entry.attachments ?? [])
                .filter((attachment) => attachment.type === "media")
                .map((attachment) => attachment.data as MediaAsset),
            ]);
        },
        cache: (sessionId, input) => persist(sessionId, input, "cache"),
        save: (sessionId, input) => persist(sessionId, input, "entry"),
        stage: (sessionId, input) => persist(sessionId, input, "draft"),
        draft(sessionId) {
          storage.getSession(sessionId);
          return storage.setting<MediaAsset[]>(`media.draft:${sessionId}`, []);
        },
        releaseDraft(sessionId, ids) {
          storage.setSetting(
            `media.draft:${sessionId}`,
            service.draft(sessionId).filter((asset) => !ids.includes(asset.id)),
          );
          ctx.get("events").publish({ type: "media-draft", sessionId });
        },
        async readDraft(sessionId, id) {
          const asset = service.draft(sessionId).find((asset) => asset.id === id);
          if (!asset) throw new Error("Draft attachment not found");
          return { asset, data: await readMedia(path(asset)) };
        },
        async read(sessionId, id) {
          const asset = service.list(sessionId).find((asset) => asset.id === id);
          if (!asset) throw new Error("Media not found on this branch");
          return { asset, data: await readMedia(path(asset)) };
        },
        async materialize(sessionId, id, destination) {
          const target = await workspace.resolve(destination, true);
          await assertNewFile(target);
          const { data } = await service.read(sessionId, id);
          await atomicCreate(target, data);
          return { path: target };
        },
      };
      ctx.provide("media", service);
      const disposers = [
        ctx.get("rpc").register("media.draft", (params) => service.draft(String(params.sessionId))),
        ctx.get("rpc").register("media.draft.remove", (params) => {
          service.releaseDraft(String(params.sessionId), [String(params.id)]);
          return {};
        }),
        ctx.get("tools").register({
          name: "export_media",
          description:
            "Export a media asset from this conversation branch to an explicit new workspace path. Existing files are never overwritten.",
          deferred: true,
          parameters: Type.Object({ id: Type.String(), path: Type.String() }),
          async execute(args, input) {
            input.signal.throwIfAborted();
            return JSON.stringify(
              await service.materialize(input.sessionId, String(args.id), String(args.path)),
            );
          },
        }),
        ctx
          .get("rpc")
          .register("media.materialize", (params) =>
            service.materialize(String(params.sessionId), String(params.id), String(params.path)),
          ),
        ctx.get("tools").register({
          name: "import_media",
          description:
            "Import an existing image, audio or video file from the workspace into the conversation media cache. Returns a durable asset reference; does not modify the source file.",
          deferred: true,
          parameters: Type.Object({ path: Type.String() }),
          async execute(args, input) {
            const source = await workspace.resolve(String(args.path));
            const extension = extname(source)
              .toLowerCase()
              .replace(/^\.jpeg$/, ".jpg");
            const mime = [...formats].find(([, value]) => value === extension)?.[0];
            if (!mime) throw new Error("Unsupported media filename extension");
            const stat = await Deno.stat(source);
            if (!stat.isFile || stat.size > maxBytes) {
              throw new Error("Choose a media file no larger than 64 MiB");
            }
            input.signal.throwIfAborted();
            const data = await readMedia(source, input.signal);
            input.signal.throwIfAborted();
            return JSON.stringify(
              await service.save(input.sessionId, {
                name: basename(source),
                mime,
                data,
              }),
            );
          },
        }),
        ctx.get("rpc").register("media.list", (params) => service.list(String(params.sessionId))),
        ctx.get("context").registerProjector("media", (value) => {
          const asset = value as MediaAsset;
          return {
            role: "user",
            content: mediaReference(asset),
            timestamp: asset.createdAt,
          };
        }),
      ];
      ctx.effect(() => () => {
        for (const dispose of disposers) dispose();
      });
    },
  },
});
