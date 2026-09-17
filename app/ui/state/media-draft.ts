import type { MediaAsset } from "../../sdk/media.ts";
import type { Transport } from "../transport.ts";

import { createEffect, createResource, createSignal, on, onCleanup } from "solid-js";

export function mediaDraft(transport: Transport, sessionId: () => string) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [assets, { refetch }] = createResource(
    () => (sessionId() ? JSON.stringify([transport.projectId, sessionId()]) : false),
    async (key) => {
      const [projectId, sessionId] = JSON.parse(key) as string[];
      return await transport.request<MediaAsset[]>("media.draft", {
        projectId,
        sessionId,
      });
    },
  );
  createEffect(on(sessionId, () => setError("")));
  const refresh = () => {
    setError("");
    return Promise.resolve(refetch()).catch(() => {});
  };
  onCleanup(
    transport.onEvent((event) => {
      if (
        event.type === "connected" ||
        (event.type === "media-draft" &&
          event.sessionId === sessionId() &&
          (!event.projectId || event.projectId === transport.projectId))
      )
        void refresh();
    }),
  );
  return {
    assets: () => (assets.error ? [] : (assets() ?? [])),
    busy: () => busy() || assets.loading,
    error: () => error() || (assets.error ? String(assets.error.message ?? assets.error) : ""),
    refresh,
    async upload(file: File, projectId: string, targetSession: string) {
      const response = await fetch(
        `/media/${encodeURIComponent(projectId)}/${encodeURIComponent(targetSession)}/upload`,
        {
          method: "POST",
          body: file,
          headers: {
            "content-type": file.type,
            "x-fathom-filename": encodeURIComponent(file.name),
          },
        },
      );
      if (!response.ok) throw new Error(await response.text());
      if (sessionId() === targetSession) await refresh();
    },
    async remove(id: string) {
      if (busy()) return;
      const targetSession = sessionId(),
        projectId = transport.projectId;
      setBusy(true);
      setError("");
      try {
        await transport.request("media.draft.remove", {
          projectId,
          sessionId: targetSession,
          id,
        });
        if (sessionId() === targetSession) await refresh();
      } catch (error) {
        if (sessionId() === targetSession) {
          setError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        setBusy(false);
      }
    },
  };
}
