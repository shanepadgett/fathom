import type {
  BrowserAnnotation,
  BrowserAnnotationBounds,
} from "../../sdk/browser.ts";
import type { PluginContext } from "../../sdk/mod.ts";

import { submittedFeedbackIds } from "../submitted-feedback.ts";

type Capture = (
  x: number,
  y: number,
  url?: string,
  bounds?: BrowserAnnotationBounds,
) => Promise<
  {
    url: string;
    element?: unknown;
    image: string;
    scroll: { x: number; y: number };
    viewport: { width: number; height: number };
  }
>;

function annotationBounds(value: unknown): BrowserAnnotationBounds | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid annotation bounds");
  }
  const { x, y, width, height } = value as Record<string, unknown>;
  if (
    typeof x !== "number" || !Number.isFinite(x) ||
    typeof y !== "number" || !Number.isFinite(y) ||
    typeof width !== "number" || !Number.isFinite(width) ||
    typeof height !== "number" || !Number.isFinite(height) ||
    x < 0 || y < 0 || width <= 0 || height <= 0
  ) throw new Error("Invalid annotation bounds");
  return { x, y, width, height };
}

export function registerBrowserAnnotations(
  ctx: PluginContext,
  capture: Capture,
  captureOwner: (viewId: unknown, sessionId: string) => () => void,
) {
  const storage = ctx.get("storage"),
    media = ctx.get("media"),
    runtime = ctx.get("runtime"),
    rpc = ctx.get("rpc");
  const feedback = ctx.get("feedback");
  const migrations = new Map<string, Promise<void>>();
  const key = (id: string) => `annotations:${id}`;
  const stored = (id: string) =>
    storage.setting<(BrowserAnnotation & { image?: string })[]>(key(id), []);
  const emit = (id: string) =>
    ctx.get("events").publish({ type: "session", sessionId: id });
  async function cache(id: string, image: string, name: string) {
    if (image.length > 12_000_000) {
      throw new Error("Annotation screenshot exceeds the image limit");
    }
    return await media.cache(id, {
      name,
      mime: "image/png",
      data: Uint8Array.from(atob(image), (char) => char.charCodeAt(0)),
    });
  }
  function reconcile(id: string) {
    const accepted = submittedFeedbackIds(
      runtime.state(id),
      "browser-feedback",
    );
    const draft = stored(id),
      remaining = draft.filter((item) => !accepted.has(item.id));
    if (remaining.length !== draft.length) {
      storage.setSetting(key(id), remaining);
    }
    return remaining;
  }
  async function list(id: string): Promise<BrowserAnnotation[]> {
    storage.getSession(id);
    reconcile(id);
    let migration = migrations.get(id);
    if (!migration) {
      migration = (async () => {
        for (const item of stored(id)) {
          if (typeof item.image !== "string") continue;
          const screenshot = await cache(
            id,
            item.image,
            `annotation-${item.id}.png`,
          );
          storage.transaction(() => {
            storage.setSetting(
              key(id),
              stored(id).map((current) => {
                if (
                  current.id !== item.id || current.image !== item.image
                ) return current;
                const { image: _image, ...metadata } = current;
                return { ...metadata, screenshot };
              }),
            );
          });
        }
      })().finally(() => migrations.delete(id));
      migrations.set(id, migration);
    }
    await migration;
    return reconcile(id);
  }
  const disposers = [
    rpc.register(
      "annotations.list",
      (params) => list(String(params.sessionId)),
    ),
    rpc.register("browser.annotate", async (params) => {
      const bounds = annotationBounds(params.bounds);
      const id = String(params.sessionId),
        x = bounds ? bounds.x + bounds.width / 2 : Number(params.x),
        y = bounds ? bounds.y + bounds.height / 2 : Number(params.y);
      storage.getSession(id);
      const assertOwner = captureOwner(params.viewId, id);
      if (
        ![x, y].every(Number.isFinite) || x < 0 || y < 0
      ) throw new Error("Invalid annotation position");
      if (
        typeof params.comment !== "string" || !params.comment.trim() ||
        params.comment.length > 4000
      ) throw new Error("Add a comment of at most 4,000 characters");
      await list(id);
      assertOwner();
      if (stored(id).length >= 20) {
        throw new Error(
          "Send or clear feedback before staging more than 20 comments",
        );
      }
      const result = await capture(
        x,
        y,
        typeof params.url === "string" ? params.url : undefined,
        bounds,
      );
      const annotationId = crypto.randomUUID();
      assertOwner();
      const annotation: BrowserAnnotation = {
        id: annotationId,
        url: result.url,
        x,
        y,
        ...(bounds ? { bounds } : {}),
        scroll: result.scroll,
        viewport: result.viewport,
        comment: params.comment.trim(),
        element: result.element,
        screenshot: await cache(
          id,
          result.image,
          `annotation-${annotationId}.png`,
        ),
      };
      storage.transaction(() => {
        assertOwner();
        const draft = reconcile(id);
        if (draft.length >= 20) {
          throw new Error(
            "Send or clear feedback before staging more than 20 comments",
          );
        }
        storage.setSetting(key(id), [...draft, annotation]);
      });
      emit(id);
      return annotation;
    }),
    rpc.register("annotations.update", (params) => {
      const id = String(params.sessionId);
      storage.getSession(id);
      if (feedback.isSubmitting(id)) {
        throw new Error("Wait for feedback submission to finish");
      }
      if (
        typeof params.comment !== "string" || !params.comment.trim() ||
        params.comment.length > 4000
      ) {
        throw new Error("Add a comment of at most 4,000 characters");
      }
      return storage.transaction(() => {
        const draft = reconcile(id);
        const previous = draft.find((item) => item.id === params.id);
        if (!previous) throw new Error("This comment is no longer staged");
        const updated = {
          ...previous,
          comment: (params.comment as string).trim(),
        };
        storage.setSetting(
          key(id),
          draft.map((item) => item.id === previous.id ? updated : item),
        );
        emit(id);
        return updated;
      });
    }),
    rpc.register("annotations.remove", (params) => {
      const id = String(params.sessionId);
      storage.getSession(id);
      if (feedback.isSubmitting(id)) {
        throw new Error("Wait for feedback submission to finish");
      }
      storage.transaction(() =>
        storage.setSetting(
          key(id),
          reconcile(id).filter((item) => item.id !== params.id),
        )
      );
      emit(id);
    }),
    rpc.register("annotations.clear", (params) => {
      const id = String(params.sessionId);
      storage.getSession(id);
      if (feedback.isSubmitting(id)) {
        throw new Error("Wait for feedback submission to finish");
      }
      storage.setSetting(key(id), []);
      emit(id);
      return {};
    }),
    rpc.register(
      "annotations.submit",
      (params) => feedback.send(String(params.sessionId), ["browser"]),
    ),
    feedback.register({
      id: "browser",
      async prepare(id) {
        const draft = await list(id);
        return {
          count: draft.length,
          text: `Please address this batched visual feedback:\n${
            JSON.stringify(draft, null, 2)
          }`,
          attachments: [
            {
              type: "browser-feedback",
              data: { ids: draft.map((item) => item.id) },
            },
            ...draft.flatMap((item) =>
              item.screenshot ? [{ type: "media", data: item.screenshot }] : []
            ),
          ],
        };
      },
      reconcile: list,
    }),
  ];
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose();
  });
}
