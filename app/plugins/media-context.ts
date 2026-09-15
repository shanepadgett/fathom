import { Buffer } from "node:buffer";

import { definePlugin } from "../sdk/mod.ts";
import { mediaReference } from "./media-reference.ts";

/** Hydrate only request-time context, never persisted messages or compaction tails. */
export const mediaContext = definePlugin({
  id: "fathom:media-context",
  apiVersion: 1,
  backend: {
    requires: ["media", "storage", "model"],
    activate(ctx) {
      ctx.cordis.on("step:model", async (input) => {
        const session = ctx.get("storage").getSession(input.sessionId);
        const model = ctx.get("model").models.getModel(
          session.provider,
          session.model,
        );
        if (!model?.input.includes("image")) return;
        const media = ctx.get("media");
        const assets = new Map(
          media.list(input.sessionId).filter((asset) =>
            asset.mime.startsWith("image/")
          ).map((asset) => [mediaReference(asset), asset]),
        );
        const messages = input.context.messages.slice();
        let count = 0;
        for (let index = messages.length - 1; index >= 0; index--) {
          input.signal.throwIfAborted();
          const message = messages[index];
          if (message.role !== "user" || typeof message.content !== "string") {
            continue;
          }
          const asset = assets.get(message.content);
          if (!asset) continue;
          let omission = "";
          if (count >= 4) {
            omission =
              "Only the four most recent referenced images are included in this request.";
          } else if (asset.bytes > 8 * 1024 * 1024) {
            omission = "This image exceeds the 8 MiB chat-image limit.";
          } else {
            try {
              const { data } = await media.read(input.sessionId, asset.id);
              if (data.byteLength > 8 * 1024 * 1024) {
                throw new Error("Image exceeds the chat-image limit");
              }
              messages[index] = {
                ...message,
                content: [
                  { type: "text", text: message.content },
                  {
                    type: "image",
                    mimeType: asset.mime,
                    data: Buffer.from(data).toString("base64"),
                  },
                ],
              };
              count++;
              continue;
            } catch (error) {
              input.signal.throwIfAborted();
              omission = `Image content is unavailable: ${
                error instanceof Error ? error.message : String(error)
              }`;
            }
          }
          messages[index] = {
            ...message,
            content: `${message.content}\n${omission}`,
          };
        }
        input.context.messages = messages;
      });
    },
  },
});
