import { createMemo, For, Show } from "solid-js";

const lineColors = {
  context: "text-muted",
  added: "bg-success/10 text-success",
  removed: "bg-danger/10 text-danger",
};

/** Preserve patch headers while classifying only lines inside unified diff hunks. */
export function diffLines(patch: string) {
  let hunk = false;
  return patch.split("\n").map((text) => {
    if (text.startsWith("diff --git ")) hunk = false;
    if (text.startsWith("@@ ")) hunk = true;
    const kind = hunk && text.startsWith("+")
      ? "added"
      : hunk && text.startsWith("-")
      ? "removed"
      : "context";
    return { text, kind } as const;
  });
}

export function DiffPreview(props: { patch: string }) {
  const lines = createMemo(() => diffLines(props.patch));
  const count = (kind: "added" | "removed") =>
    lines().filter((line) => line.kind === kind).length;
  return (
    <Show
      when={props.patch}
      fallback={
        <p class="px-6 py-6 text-sm text-muted">No text diff available.</p>
      }
    >
      <div
        class="flex gap-2 border-b border-line px-6 py-2 font-mono text-sm"
        aria-label="Changed line counts"
      >
        <span class="text-success">+{count("added")}</span>
        <span class="text-danger">−{count("removed")}</span>
      </div>
      <div
        class="max-h-96 overflow-auto py-6 font-mono text-sm leading-relaxed"
        tabindex="0"
        aria-label="File diff"
      >
        <For each={lines()}>
          {(line) => (
            <pre
              class={`px-6 ${lineColors[line.kind]}`}
            >{line.text || " "}</pre>
          )}
        </For>
      </div>
    </Show>
  );
}
