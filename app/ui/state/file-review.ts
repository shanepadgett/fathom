import type { FileDiff } from "../../sdk/git.ts";
import type { Transport } from "../transport.ts";

import { createSignal, onCleanup } from "solid-js";

/** Owns review requests independently of editor and commit-screen presentation. */
export function createFileReview(transport: Transport, failed: (error: unknown) => void) {
  const projectId = transport.projectId;
  const [document, setDocument] = createSignal<FileDiff>();
  const [busy, setBusy] = createSignal(false);
  const [stale, setStale] = createSignal(false);
  let version = 0;
  let changes = 0;
  let selected = "";
  let disposed = false;

  async function open(path: string) {
    const requestVersion = ++version,
      changeVersion = changes;
    if (selected !== path) setDocument(undefined);
    selected = path;
    setBusy(true);
    try {
      const next = await transport.request<FileDiff>("git.diff", {
        projectId,
        path,
      });
      if (disposed || requestVersion !== version || transport.projectId !== projectId) return;
      setDocument(next);
      setStale(changes !== changeVersion);
    } catch (error) {
      if (!disposed && requestVersion === version && transport.projectId === projectId)
        failed(error);
    } finally {
      if (!disposed && requestVersion === version) setBusy(false);
    }
  }

  const unsubscribe = transport.onEvent((event) => {
    if (event.projectId && event.projectId !== projectId) return;
    const changed = (event.data as { changed?: boolean } | undefined)?.changed;
    // Tool paths can be absolute or relative; conservatively invalidate project writes.
    if (
      (event.type === "file" && changed !== false) ||
      ["git", "connected", "disconnected", "environment"].includes(event.type)
    ) {
      ++changes;
      if (document()) setStale(true);
    }
  });
  function close() {
    ++version;
    selected = "";
    setDocument(undefined);
    setBusy(false);
    setStale(false);
  }
  onCleanup(() => {
    disposed = true;
    close();
    unsubscribe();
  });
  return {
    document,
    busy,
    stale,
    open,
    close,
    refresh: () => (selected ? open(selected) : Promise.resolve()),
  };
}
