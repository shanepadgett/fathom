import type { CommitGroup } from "../../sdk/git.ts";

import { For, Index } from "solid-js";

import { Button } from "./primitives.tsx";

export function CommitPlanEditor(props: {
  commits: CommitGroup[];
  disabled: boolean;
  onChange(commits: CommitGroup[]): void;
}) {
  const change = (update: (items: CommitGroup[]) => CommitGroup[]) => {
    if (!props.disabled) props.onChange(update(props.commits));
  };
  const update = (index: number, changes: Partial<CommitGroup>) =>
    change((items) =>
      items.map((item, i) => i === index ? { ...item, ...changes } : item)
    );
  const move = (from: number, to: number) =>
    change((items) => {
      if (
        from === to || from < 0 || to < 0 || from >= items.length ||
        to >= items.length
      ) return items;
      const next = [...items];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  return (
    <Index each={props.commits}>
      {(commit, index) => (
        <article
          class="commit-card"
          draggable={!props.disabled}
          onDragStart={(event) =>
            event.dataTransfer?.setData(
              "application/x-fathom-commit-index",
              String(index),
            )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const raw = event.dataTransfer?.getData(
              "application/x-fathom-commit-index",
            );
            if (!raw) return;
            const from = Number(raw);
            if (
              Number.isInteger(from) && from >= 0 && from < props.commits.length
            ) move(from, index);
          }}
        >
          <header>
            <strong>{index + 1}</strong>
            <input
              disabled={props.disabled}
              aria-label={`Commit ${index + 1} title`}
              value={commit().title}
              onInput={(event) =>
                update(index, { title: event.currentTarget.value })}
            />
            <Button
              disabled={props.disabled || index === 0}
              onClick={() => move(index, index - 1)}
            >
              ↑
            </Button>
            <Button
              disabled={props.disabled || index === props.commits.length - 1}
              onClick={() => move(index, index + 1)}
            >
              ↓
            </Button>
          </header>
          <textarea
            disabled={props.disabled}
            aria-label={`Commit ${index + 1} description`}
            value={commit().body}
            onInput={(event) =>
              update(index, { body: event.currentTarget.value })}
          />
          <For each={commit().files}>
            {(file) => (
              <div class="commit-file">
                <span>{file}</span>
                <select
                  disabled={props.disabled}
                  aria-label={`Move ${file} to commit`}
                  value={index}
                  onChange={(event) => {
                    const target = Number(event.currentTarget.value);
                    if (
                      target === index || !Number.isInteger(target) ||
                      target < 0 || target >= props.commits.length
                    ) return;
                    change((items) =>
                      items.map((item, i) =>
                        i === index
                          ? {
                            ...item,
                            files: item.files.filter((path) => path !== file),
                          }
                          : i === target
                          ? { ...item, files: [...item.files, file] }
                          : item
                      )
                    );
                  }}
                >
                  <For each={props.commits}>
                    {(item, i) => (
                      <option value={i()}>{i() + 1}. {item.title}</option>
                    )}
                  </For>
                </select>
              </div>
            )}
          </For>
          <div class="actions">
            <Button
              disabled={props.disabled}
              onClick={() =>
                change(
                  (items) => [...items, {
                    title: "chore: separate changes",
                    body: "",
                    files: [],
                  }],
                )}
            >
              Split
            </Button>
            <Button
              disabled={props.disabled || index === props.commits.length - 1}
              onClick={() =>
                change((items) => {
                  const next = [...items],
                    following = next.splice(index + 1, 1)[0];
                  next[index] = {
                    ...commit(),
                    files: [...commit().files, ...following.files],
                  };
                  return next;
                })}
            >
              Merge next
            </Button>
            <Button
              disabled={props.disabled}
              onClick={() =>
                change((items) => items.filter((_, i) => i !== index))}
            >
              Exclude commit
            </Button>
          </div>
        </article>
      )}
    </Index>
  );
}
