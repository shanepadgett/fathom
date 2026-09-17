import type { FileDiff as DiffDocument } from "../../sdk/git.ts";

import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

import { DiffPreview } from "./diff-preview.tsx";
import { Button, IconButton } from "./primitives.tsx";
import { TabStrip } from "./tab-strip.tsx";

function DiffViewport(props: {
  projectId?: string;
  document: DiffDocument;
  theme: string;
  fill?: boolean;
  mode: "inline" | "split";
  selectMode(mode: "inline" | "split"): void;
}) {
  const [loading, setLoading] = createSignal(true);
  const [failure, setFailure] = createSignal("");
  let element!: HTMLDivElement;
  let engine: ReturnType<typeof import("./diff-engine.ts").mountDiff> | undefined;
  let disposed = false;
  onMount(() => {
    void import("./diff-engine.ts")
      .then((module) => {
        if (disposed) return;
        engine = module.mountDiff(element, props.document, props.theme, props.projectId);
        engine.update(props.theme, props.mode === "split");
      })
      .catch((error) => {
        if (!disposed) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
  });
  createEffect(() => {
    const theme = props.theme,
      split = props.mode === "split";
    engine?.update(theme, split);
  });
  onCleanup(() => {
    disposed = true;
    engine?.dispose();
  });
  return (
    <div
      class={`flex min-h-0 flex-col ${props.fill ? "flex-1" : ""}`}
      aria-label={`Review ${props.document.path}`}
    >
      <div class="flex shrink-0 items-center border-b border-line">
        <div class="min-w-0 flex-1">
          <TabStrip
            items={[
              { id: "inline", label: "Inline" },
              {
                id: "split",
                label: "Side by side",
              },
            ]}
            selected={props.mode}
            select={props.selectMode}
            label="Diff presentation"
          />
        </div>
        <IconButton
          name="arrow-up"
          label="Previous change"
          disabled={loading() || !!failure()}
          onClick={() => engine?.navigate("previous")}
        />
        <IconButton
          name="arrow-down"
          label="Next change"
          disabled={loading() || !!failure()}
          onClick={() => engine?.navigate("next")}
        />
      </div>
      <Show when={loading()}>
        <p class="px-6 py-2 text-sm text-muted">Loading diff…</p>
      </Show>
      <Show when={failure()}>
        <p class="px-6 py-2 text-sm text-danger">{failure()}</p>
      </Show>
      <div
        ref={element}
        class={props.fill ? "min-h-0 flex-1" : "h-[min(60vh,40rem)] min-h-48"}
        aria-label="File comparison"
      />
    </div>
  );
}

export function FileDiff(props: {
  projectId?: string;
  document: DiffDocument;
  theme: string;
  fill?: boolean;
  refresh?(): void;
  refreshing?: boolean;
  stale?: boolean;
}) {
  const [mode, setMode] = createSignal<"inline" | "split">("inline");
  const binary = () =>
    props.document.original.includes("\0") || props.document.modified.includes("\0");
  return (
    <div class={`flex min-h-0 flex-col ${props.fill ? "flex-1" : ""}`}>
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-line px-6 py-2 text-sm text-muted">
        <span classList={{ "text-warning": props.stale }}>
          {props.stale
            ? "Files may have changed. Refresh this review."
            : "Saved files at the time of review"}
        </span>
        <Show when={props.refresh}>
          <Button disabled={props.refreshing} onClick={props.refresh}>
            {props.refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </Show>
      </div>
      <Show when={!binary()} fallback={<DiffPreview patch={props.document.patch} />}>
        <Show when={props.document} keyed>
          {(document) => (
            <DiffViewport
              projectId={props.projectId}
              document={document}
              theme={props.theme}
              fill={props.fill}
              mode={mode()}
              selectMode={setMode}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
