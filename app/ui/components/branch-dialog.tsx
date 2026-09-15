import type { Entry } from "../../sdk/session.ts";
import type { createWorkspace } from "../state/workspace.ts";

import { createResource, createSignal, Show } from "solid-js";

import { Button, Field, Modal } from "./primitives.tsx";

export function BranchDialog(
  props: { app: ReturnType<typeof createWorkspace>; entry: Entry },
) {
  const app = props.app;
  const sessionId = app.sessionId();
  const projectId = app.transport.projectId;
  const [preview] = createResource(() =>
    app.transport.request<{ canRestore: boolean }>("branch.preview", {
      projectId,
      sessionId,
      entryId: props.entry.id,
    })
  );
  const [mode, setMode] = createSignal("standard");
  const [focus, setFocus] = createSignal("");
  const [restore, setRestore] = createSignal(false);
  const [confirm, setConfirm] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function create(confirmed = false) {
    if (busy()) return;
    if (restore() && !confirmed) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await app.transport.request("branch.create", {
        projectId,
        sessionId,
        entryId: props.entry.id,
        summaryMode: mode(),
        focus: mode() === "focused" ? focus().trim() : undefined,
        restore: restore(),
        confirmRestore: confirmed,
      });
      await app.refresh();
      app.setRewind(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title="Branch conversation"
        close={() => {
          if (!busy()) app.setRewind(undefined);
        }}
      >
        <p class="mb-4">
          Continue from this message. The previous conversation branch remains
          saved.
        </p>
        <Field label="Carry forward">
          <select
            disabled={busy()}
            value={mode()}
            onChange={(event) => setMode(event.currentTarget.value)}
          >
            <option value="standard">Standard summary</option>
            <option value="focused">Custom prompt summary</option>
            <option value="none">No summary</option>
          </select>
        </Field>
        <Show when={mode() === "focused"}>
          <Field label="Summary focus">
            <textarea
              disabled={busy()}
              value={focus()}
              onInput={(event) => setFocus(event.currentTarget.value)}
              placeholder="Focus only on why the migration failed"
            />
          </Field>
        </Show>
        <label class="my-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={restore()}
            disabled={busy() || !preview()?.canRestore}
            onChange={(event) => setRestore(event.currentTarget.checked)}
          />
          <span>
            Restore workspace files to this message<Show
              when={!preview.loading && !preview()?.canRestore}
            >
              <span class="block text-muted">
                The snapshot is unavailable. Conversation branching is still
                available.
              </span>
            </Show>
          </span>
        </label>
        <Show when={error() || preview.error}>
          <p role="alert" class="mb-3 text-danger">
            {error() || "Could not inspect the file snapshot."}
          </p>
        </Show>
        <div class="flex justify-end gap-3">
          <Button disabled={busy()} onClick={() => app.setRewind(undefined)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy() || (mode() === "focused" && !focus().trim())}
            onClick={() => void create()}
          >
            {busy() ? "Preparing branch…" : "Create branch"}
          </Button>
        </div>
      </Modal>
      <Show when={confirm()}>
        <Modal
          title="Restore workspace files?"
          close={() => {
            if (!busy()) setConfirm(false);
          }}
        >
          <p>
            Reverting to this point will undo all workspace file changes made
            since this turn. Continue?
          </p>
          <div class="mt-4 flex justify-end gap-3">
            <Button disabled={busy()} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy()}
              onClick={() => void create(true)}
            >
              Restore files and branch
            </Button>
          </div>
        </Modal>
      </Show>
    </>
  );
}
