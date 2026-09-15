import type { GitState } from "../../sdk/git.ts";

import { For, Show } from "solid-js";

import { FileRow } from "./file-tree.tsx";

function ChangeStatus(props: { code: string }) {
  const status = () => {
    const code = props.code;
    if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(code)) {
      return ["!", "Conflicted", "text-danger"];
    }
    if (code === "??") return ["?", "Untracked", "text-muted"];
    if (code.includes("D")) return ["D", "Deleted", "text-danger"];
    if (code.includes("R")) return ["R", "Renamed", "text-action"];
    if (code.includes("C")) return ["C", "Copied", "text-success"];
    if (code.includes("A")) return ["A", "Added", "text-success"];
    return ["M", "Modified", "text-action"];
  };
  return (
    <span
      class={`shrink-0 text-micro ${status()[2]}`}
      aria-label={status()[1]}
      title={`${status()[1]} (${props.code})`}
    >
      {status()[0]}
    </span>
  );
}

export function ChangedFileList(props: {
  files: GitState["files"];
  selected: string;
  open(path: string): void;
}) {
  return (
    <div
      data-component="changed-files"
      class="p-2 text-dense"
      aria-label="Changed files"
    >
      <p class="flex flex-wrap items-center gap-2 px-2 pb-2 text-muted">
        {props.files.length} {props.files.length === 1 ? "file" : "files"}{" "}
        changed
      </p>
      <For each={props.files}>
        {(file) => (
          <FileRow
            file={{ name: file.path, path: file.path, directory: false }}
            selected={props.selected === file.path}
            tree={false}
            trailing={<ChangeStatus code={file.code} />}
            open={() => props.open(file.path)}
          />
        )}
      </For>
      <Show when={!props.files.length}>
        <p class="p-2 text-muted">No changed files</p>
      </Show>
    </div>
  );
}
