import type { GitState } from "../../sdk/git.ts";

import { createResource, Show } from "solid-js";

import { ChangedFileList } from "./changed-file-list.tsx";

export function ChangedFiles(
  props: {
    load(): Promise<GitState>;
    revision: number;
    selected: string;
    open(path: string): void;
  },
) {
  const [status, { refetch }] = createResource(
    () => props.revision,
    props.load,
  );
  return (
    <div
      data-component="changes-panel"
      class="overflow-auto text-dense"
      aria-label="Changed files"
    >
      <Show when={status.error}>
        <button class="p-2 text-danger" onClick={() => void refetch()}>
          Could not load changes. Retry
        </button>
      </Show>
      <Show when={status.loading && !status()}>
        <p class="p-2 text-muted">Loading changes…</p>
      </Show>
      <Show when={status()}>
        {(state) => (
          <Show
            when={state().available}
            fallback={
              <p class="p-2 text-muted">
                This workspace is not a Git repository.
              </p>
            }
          >
            <ChangedFileList
              files={state().files}
              selected={props.selected}
              open={props.open}
            />
          </Show>
        )}
      </Show>
    </div>
  );
}
