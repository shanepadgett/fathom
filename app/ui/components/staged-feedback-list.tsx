import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";

import { CommentField } from "./comment-field.tsx";
import { Button, Field } from "./primitives.tsx";

interface StagedComment {
  id: string;
  label: string;
  comment: string;
  quote?: string;
}

/** Editing state belongs to the list, so draft refreshes do not reset typing. */
export function StagedFeedbackList(props: {
  sessionId: string;
  source: string;
  items: StagedComment[];
  disabled?: boolean;
  working(value: boolean): void;
  save(sessionId: string, item: StagedComment): Promise<unknown>;
  remove(sessionId: string, id: string): Promise<unknown>;
  review?(id: string): void;
}) {
  const [editing, setEditing] = createSignal<StagedComment>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let input!: HTMLTextAreaElement;
  createEffect(on(() => props.sessionId, () => {
    setEditing(undefined);
    setError("");
  }));
  createEffect(() => props.working(busy() || !!editing()));
  onCleanup(() => props.working(false));
  async function act(action: () => Promise<unknown>) {
    if (busy() || props.disabled) return;
    const sessionId = props.sessionId;
    setBusy(true);
    setError("");
    try {
      await action();
      if (sessionId === props.sessionId) setEditing(undefined);
    } catch (cause) {
      if (sessionId === props.sessionId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="max-h-64 space-y-3 overflow-auto pb-2 text-ink">
      <ol class="space-y-3" aria-label={`Staged ${props.source} feedback`}>
        <For each={props.items}>
          {(item, index) => (
            <li class="space-y-1">
              <p class="break-all text-xs text-muted">
                #{index() + 1} · {item.label}
              </p>
              <p class="whitespace-pre-wrap text-sm">{item.comment}</p>
              <div class="flex gap-3">
                <Button
                  disabled={busy() || props.disabled || !!editing()}
                  onClick={() => {
                    setEditing({ ...item });
                    queueMicrotask(() => input?.focus());
                  }}
                >
                  Edit
                </Button>
                <Button
                  disabled={busy() || props.disabled || !!editing()}
                  onClick={() =>
                    void act(() => props.remove(props.sessionId, item.id))}
                >
                  Remove
                </Button>
                <Show when={props.review}>
                  <Button onClick={() => props.review?.(item.id)}>
                    Open artifact
                  </Button>
                </Show>
              </div>
            </li>
          )}
        </For>
      </ol>
      <Show when={editing()}>
        <div class="space-y-3 border-t border-line pt-3">
          <p class="text-xs text-muted">Editing {editing()?.label}</p>
          <Show when={editing()?.quote !== undefined}>
            <Field label="Passage (optional)">
              <textarea
                rows={2}
                maxLength={4000}
                disabled={busy() || props.disabled}
                value={editing()?.quote ?? ""}
                onInput={(event) =>
                  setEditing((item) =>
                    item && ({ ...item, quote: event.currentTarget.value })
                  )}
              />
            </Field>
          </Show>
          <CommentField
            input={(element) => input = element}
            value={editing()?.comment ?? ""}
            disabled={busy() || props.disabled}
            change={(comment) =>
              setEditing((item) => item && ({ ...item, comment }))}
          />
          <div class="flex gap-3">
            <Button
              variant="secondary"
              disabled={busy() || props.disabled || !editing()?.comment.trim()}
              onClick={() => {
                const item = editing();
                if (item) void act(() => props.save(props.sessionId, item));
              }}
            >
              {busy() ? "Saving…" : "Save comment"}
            </Button>
            <Button
              disabled={busy()}
              onClick={() => {
                setEditing(undefined);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Show>
      <Show when={error()}>
        <p role="alert" class="text-sm text-danger">{error()}</p>
      </Show>
    </div>
  );
}
