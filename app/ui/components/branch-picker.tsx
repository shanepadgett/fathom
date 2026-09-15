import type { Entry } from "../../sdk/session.ts";
import type { createWorkspace } from "../state/workspace.ts";

import { createResource, createSignal, For, Show } from "solid-js";

import { Button, Modal } from "./primitives.tsx";

function preview(entry: Entry) {
  const content = entry.message?.content;
  return typeof content === "string"
    ? content
    : content?.filter((block) => block.type === "text").map((block) =>
      block.text
    ).join("\n") || entry.custom?.type || "Conversation boundary";
}

export function BranchPicker(
  props: { app: ReturnType<typeof createWorkspace> },
) {
  const app = props.app;
  const projectId = app.transport.projectId;
  const sessionId = app.sessionId();
  const [entries, { refetch }] = createResource(
    () => sessionId,
    (sessionId) =>
      app.transport.request<Entry[]>("branches.list", { projectId, sessionId }),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const items = () => entries.error ? [] : entries() ?? [];
  const current = () =>
    app.transport.projectId === projectId && app.sessionId() === sessionId;
  async function reload() {
    try {
      await refetch();
    } catch { /* The resource exposes the load failure below. */ }
  }
  async function select(entry: Entry) {
    if (busy()) return;
    if (!current()) {
      setError(
        "The conversation changed. Reopen branches for the current conversation.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await app.transport.request("branch.switch", {
        projectId,
        sessionId,
        entryId: entry.id,
      });
      if (current()) {
        await app.refresh();
        app.setBranchesOpen(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Conversation branches"
      close={() => {
        if (!busy()) app.setBranchesOpen(false);
      }}
    >
      <p class="mb-4 text-sm text-muted">
        Switch the conversation context to a saved branch. Workspace files stay
        as they are.
      </p>
      <Show when={error() || entries.error}>
        <p role="alert" class="mb-3 text-danger">
          {error() || "Could not load branches."}
        </p>
      </Show>
      <Show when={entries.error}>
        <Button
          variant="secondary"
          disabled={entries.loading}
          onClick={() => void reload()}
        >
          Retry loading
        </Button>
      </Show>
      <Show when={entries.loading}>
        <p>Loading branches…</p>
      </Show>
      <div class="flex flex-col gap-3">
        <For each={items()}>
          {(entry) => (
            <section class="rounded-lg border border-line p-3">
              <p class="mb-3 line-clamp-3 whitespace-pre-wrap text-sm">
                {preview(entry)}
              </p>
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-muted">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <Button
                  variant="secondary"
                  disabled={busy() ||
                    entry.id === app.state()?.session.activeLeafId ||
                    entry.status === "pending"}
                  onClick={() => void select(entry)}
                >
                  {entry.id === app.state()?.session.activeLeafId
                    ? "Current"
                    : "Switch"}
                </Button>
              </div>
            </section>
          )}
        </For>
        <Show when={!entries.loading && !entries.error && !items().length}>
          <p class="text-muted">No saved branches yet.</p>
        </Show>
      </div>
    </Modal>
  );
}
