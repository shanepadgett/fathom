import type { GitState } from "../../sdk/git.ts";
import type { Transport } from "../transport.ts";

import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { createFileReview } from "../state/file-review.ts";
import { ChangedFileList } from "./changed-file-list.tsx";
import { DiffDrawer } from "./diff-drawer.tsx";
import { Button } from "./primitives.tsx";

/** Workspace review stays separate from commit planning and repository management. */
export function WorkspaceChanges(
  props: {
    transport: Transport;
    theme: string;
    initialPath?: string;
    close(): void;
    commits(): void;
  },
) {
  const projectId = props.transport.projectId;
  const [status, setStatus] = createSignal<GitState>();
  const [loading, setLoading] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  let disposed = false;
  const fail = (error: unknown) => {
    if (!disposed) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const review = createFileReview(props.transport, fail);
  async function refresh() {
    if (loading()) return;
    setLoading(true);
    setFailure("");
    try {
      const next = await props.transport.request<GitState>("git.status", {
        projectId,
      });
      if (!disposed) setStatus(next);
    } catch (error) {
      fail(error);
    } finally {
      if (!disposed) setLoading(false);
    }
  }
  onMount(() => {
    void refresh();
    if (props.initialPath) void review.open(props.initialPath);
  });
  onCleanup(() => {
    disposed = true;
  });
  return (
    <DiffDrawer
      projectId={props.transport.projectId}
      document={review.document()}
      theme={props.theme}
      count={status()?.files.length}
      close={props.close}
      refresh={() => void review.refresh()}
      refreshing={review.busy()}
      stale={review.stale()}
      footer={
        <>
          <Show
            when={review.document()}
            fallback={
              <Button
                disabled={loading()}
                onClick={() => void refresh()}
              >
                Refresh files
              </Button>
            }
          >
            <Button
              onClick={() => {
                review.close();
                void refresh();
              }}
            >
              All changed files
            </Button>
          </Show>
          <Button onClick={props.commits}>Changes &amp; commits</Button>
        </>
      }
    >
      <Show when={failure()}>
        <p role="alert" class="shrink-0 px-6 py-3 text-sm text-danger">
          {failure()}
        </p>
      </Show>
      <Show when={!review.document()}>
        <div class="min-h-0 flex-1 overflow-auto">
          <Show when={loading()}>
            <p class="px-6 py-3 text-sm text-muted">Loading changes…</p>
          </Show>
          <Show when={review.busy()}>
            <p class="px-6 py-3 text-sm text-muted">Loading file review…</p>
          </Show>
          <Show when={status()}>
            {(state) => (
              <Show
                when={state().available}
                fallback={
                  <p class="px-6 py-3 text-sm text-muted">
                    This workspace is not a Git repository.
                  </p>
                }
              >
                <ChangedFileList
                  files={state().files}
                  selected=""
                  open={(path) => {
                    setFailure("");
                    void review.open(path);
                  }}
                />
              </Show>
            )}
          </Show>
        </div>
      </Show>
    </DiffDrawer>
  );
}
