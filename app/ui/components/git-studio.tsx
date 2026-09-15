import { createFileReview } from "../state/file-review.ts";
import type {
  CommitGroup as Commit,
  CommitPlan,
  GitState,
} from "../../sdk/git.ts";

import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, Show } from "solid-js";

import { ChangedFileList } from "./changed-file-list.tsx";
import { CommitPlanEditor } from "./commit-plan-editor.tsx";
import { FileDiff } from "./file-diff.tsx";
import { Button, Field, Modal } from "./primitives.tsx";

export function GitStudio(
  props: {
    transport: Transport;
    sessionId: string;
    theme: string;
    close(): void;
    openProject(path: string): Promise<void>;
  },
) {
  const [status, { refetch }] = createResource(() =>
    props.transport.request<GitState>("git.status")
  );
  const [branches, { refetch: refreshBranches }] = createResource(() =>
    props.transport.request<string[]>("git.branches")
  );
  const [worktrees, { refetch: refreshWorktrees }] = createResource(() =>
    props.transport.request<{ worktree: string; branch?: string }[]>(
      "git.worktrees",
    )
  );
  const [commits, setCommits] = createSignal<Commit[]>([]),
    [version, setVersion] = createSignal("");
  const [busy, setBusy] = createSignal(false),
    [name, setName] = createSignal("");
  const [failure, setFailure] = createSignal("");
  const review = createFileReview(
    props.transport,
    (error) =>
      setFailure(error instanceof Error ? error.message : String(error)),
  );
  const diff = review.document;
  const refresh = async () => {
    await Promise.all([refetch(), refreshBranches(), refreshWorktrees()]);
  };
  const act = async (action: () => Promise<unknown>) => {
    if (busy()) return;
    setBusy(true);
    setFailure("");
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const execute = async (push = false) => {
    await props.transport.request("git.commit", {
      commits: commits().filter((commit) => commit.files.length),
      version: version(),
      push,
    });
    setCommits([]);
    review.close();
    await refresh();
  };
  return (
    <Modal title="Changes & commits" close={props.close} wide>
      <Show when={failure()}>
        <p role="alert" class="mb-3 whitespace-pre-wrap text-sm text-danger">
          {failure()}
        </p>
      </Show>
      <Show
        when={status()?.available}
        fallback={<p class="muted">This workspace is not a Git repository.</p>}
      >
        <div class="git-controls">
          <Field label="Branch">
            <select
              disabled={busy()}
              value={status()?.branch}
              onChange={(event) => {
                const branch = event.currentTarget.value;
                void act(async () => {
                  await props.transport.request("git.switch", { branch });
                  await refresh();
                });
              }}
            >
              <For
                each={[
                  ...new Set(
                    [status()?.branch, ...(branches() ?? [])].filter((
                      branch,
                    ): branch is string => !!branch),
                  ),
                ]}
              >
                {(branch) => <option>{branch}</option>}
              </For>
            </select>
          </Field>
          <Field label="Create branch or worktree">
            <input
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
              placeholder="feature-name"
            />
          </Field>
          <Button
            disabled={busy() || !name()}
            onClick={() =>
              void act(async () => {
                await props.transport.request("git.createBranch", {
                  branch: name(),
                });
                await refresh();
              })}
          >
            New branch
          </Button>
          <Button
            disabled={busy() || !name()}
            onClick={() =>
              void act(async () => {
                await props.transport.request("git.createWorktree", {
                  name: name(),
                });
                await refresh();
              })}
          >
            New worktree
          </Button>
        </div>
        <details>
          <summary>Worktrees</summary>
          <For each={worktrees()}>
            {(tree) => (
              <div class="worktree-row">
                <span class="mono">{tree.worktree}</span>
                <Button
                  onClick={() =>
                    void act(async () => {
                      await props.openProject(tree.worktree);
                      props.close();
                    })}
                >
                  Open
                </Button>
              </div>
            )}
          </For>
        </details>
        <div
          class="max-h-64 overflow-auto"
          aria-label="Files available for commit review"
        >
          <ChangedFileList
            files={status()?.files ?? []}
            selected={diff()?.path ?? ""}
            open={(path) => void review.open(path)}
          />
        </div>
        <Show when={diff()}>
          {(file) => (
            <details open>
              <summary>{file().path}</summary>
              <FileDiff
                projectId={props.transport.projectId}
                document={file()}
                theme={props.theme}
                refresh={() => void review.refresh()}
                refreshing={review.busy()}
                stale={review.stale()}
              />
            </details>
          )}
        </Show>
        <div class="actions">
          <Button
            disabled={busy() || !status()?.files.length}
            onClick={() =>
              void act(async () => {
                const plan = await props.transport.request<CommitPlan>(
                  "git.planCommits",
                  { sessionId: props.sessionId },
                );
                setVersion(plan.version);
                setCommits(plan.commits);
              })}
          >
            {busy() ? "Working…" : "Plan atomic commits"}
          </Button>
        </div>
        <CommitPlanEditor
          commits={commits()}
          disabled={busy()}
          onChange={setCommits}
        />
        <Show when={commits().length}>
          <p class="muted">
            Commits include the complete working copy of each listed file.
            Review the file allocation and messages before executing.
          </p>
          <div class="actions">
            <Button
              variant="primary"
              disabled={busy()}
              onClick={() => void act(() => execute())}
            >
              Execute commits
            </Button>
            <Button
              disabled={busy()}
              onClick={() => {
                if (
                  confirm(
                    "Create these commits and push them to the tracking remote?",
                  )
                ) void act(() => execute(true));
              }}
            >
              Commit & push
            </Button>
          </div>
        </Show>
      </Show>
    </Modal>
  );
}
