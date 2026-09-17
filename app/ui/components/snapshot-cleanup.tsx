import type { SnapshotPrunePlan } from "../../sdk/snapshots.ts";
import type { Transport } from "../transport.ts";

import { createSignal, Show } from "solid-js";

import { Button } from "./primitives.tsx";

export function SnapshotCleanup(props: { transport: Transport; onCleaned: () => void }) {
  const [plan, setPlan] = createSignal<SnapshotPrunePlan>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [result, setResult] = createSignal("");
  const projectId = props.transport.projectId;
  async function inspect() {
    if (busy()) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      setPlan(
        await props.transport.request<SnapshotPrunePlan>("snapshots.planPrune", { projectId }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  async function clean() {
    const current = plan();
    if (busy() || !current) return;
    setBusy(true);
    setError("");
    try {
      const value = await props.transport.request<{ removed: number }>("snapshots.prune", {
        projectId,
        trees: current.trees,
      });
      setPlan(undefined);
      setResult(
        `Removed ${value.removed} snapshot references and collected unused objects. Shared objects may remain in use.`,
      );
      props.onCleaned();
    } catch (cause) {
      setError(
        `Cleanup could not be confirmed. It may still be running, and some selected references may already be removed. Retrying waits for earlier snapshot operations before checking the selection again. ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="space-y-3 border-t border-line pt-4">
      <div>
        <h3>Snapshot cleanup</h3>
        <p class="muted">Current project only. Remove snapshots unused for 30 days.</p>
      </div>
      <Show when={error()}>
        <p role="alert" class="text-sm text-danger">
          {error()}
        </p>
      </Show>
      <Show when={result()}>
        <p role="status" class="text-sm text-muted">
          {result()}
        </p>
      </Show>
      <Show
        when={plan()}
        fallback={
          <Button variant="secondary" disabled={busy()} onClick={() => void inspect()}>
            {busy() ? "Inspecting…" : "Review snapshot cleanup"}
          </Button>
        }
      >
        {(value) => (
          <>
            <p>
              {value().trees.length} snapshots eligible; {value().retained} retained.
            </p>
            <p class="text-sm text-muted">
              Removing snapshots can permanently remove file restoration for older messages.
              Conversation history remains available. Recently reused snapshots are checked again
              and kept.
            </p>
            <p class="text-xs text-muted">
              Snapshots without age records receive a new 30-day retention period. Cleanup also
              collects objects left by an interrupted cleanup.
            </p>
            <div class="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={busy()} onClick={() => void clean()}>
                {busy() ? "Cleaning…" : "Remove eligible snapshots"}
              </Button>
              <Button disabled={busy()} onClick={() => setPlan(undefined)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}
