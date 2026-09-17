import type { Transport } from "../transport.ts";

import { createSignal } from "solid-js";

/** One store per transport keeps draft state out of presentation components. */
export function createDraftStore(transport: Transport) {
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const projects = new Map<string, string>();
  const writes = new Map<string, Promise<void>>();
  const loading = new Map<string, Promise<void>>();
  const error = (id: string, message: string) =>
    setErrors((values) => ({ ...values, [id]: message }));

  function load(id: string, projectId: string) {
    if (!id) return;
    projects.set(id, projectId);
    if (Object.hasOwn(drafts(), id) || loading.has(id)) return;
    const pending = transport
      .request<string>("session.draft.get", {
        sessionId: id,
        projectId,
      })
      .then((value) => {
        setDrafts((values) => (Object.hasOwn(values, id) ? values : { ...values, [id]: value }));
        error(id, "");
      })
      .catch(() => error(id, "Saved draft could not be loaded."))
      .finally(() => loading.delete(id));
    loading.set(
      id,
      pending.then(() => {}),
    );
  }

  function update(id: string, change: (previous: string) => string) {
    const projectId = projects.get(id);
    if (!id || !projectId) return;
    const value = change(drafts()[id] ?? "");
    setDrafts((values) => ({ ...values, [id]: value }));
    const pending = (writes.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await transport.request("session.draft.set", {
          sessionId: id,
          projectId,
          text: value,
        });
      });
    writes.set(id, pending);
    void pending
      .then(
        () => {
          if (writes.get(id) === pending) error(id, "");
        },
        () => error(id, "Draft could not be saved. Copy your text before closing."),
      )
      .finally(() => {
        if (writes.get(id) === pending) writes.delete(id);
      });
  }

  return {
    load,
    update,
    text: (id: string) => drafts()[id] ?? "",
    error: (id: string) => errors()[id] ?? "",
  };
}

const stores = new WeakMap<Transport, ReturnType<typeof createDraftStore>>();

export function sessionDrafts(transport: Transport) {
  let store = stores.get(transport);
  if (!store) {
    store = createDraftStore(transport);
    stores.set(transport, store);
  }
  return store;
}
