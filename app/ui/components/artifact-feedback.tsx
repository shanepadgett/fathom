import type { ArtifactFeedback as Feedback } from "../../sdk/artifact-feedback.ts";
import type { Transport } from "../transport.ts";

import { createEffect, createSignal, For, Show } from "solid-js";

import { artifactFeedback } from "../state/artifact-feedback.ts";

import { CommentField } from "./comment-field.tsx";
import { Button, Field } from "./primitives.tsx";

export function ArtifactFeedback(
  props: {
    transport: Transport;
    sessionId: string;
    artifactId: string;
    quote: string;
  },
) {
  const { draft, refetch } = artifactFeedback(
    props.transport,
    () => props.sessionId,
  );
  const [quote, setQuote] = createSignal("");
  const [comment, setComment] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [sent, setSent] = createSignal("");
  const [editing, setEditing] = createSignal<Feedback>();
  let commentInput!: HTMLTextAreaElement;
  createEffect(() => setQuote(props.quote));
  async function act(action: () => Promise<void>) {
    if (busy()) return;
    setBusy(true);
    setError("");
    setSent("");
    try {
      await action();
      await refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="space-y-3 border-t border-line pt-4">
      <h3 class="text-sm font-medium">Feedback</h3>
      <p class="text-xs text-muted">
        Select a passage in the preview or enter one below. Stage comments, then
        send them together.
      </p>
      <Field label="Passage (optional)">
        <textarea
          rows={2}
          maxLength={4000}
          value={quote()}
          onInput={(event) => setQuote(event.currentTarget.value)}
        />
      </Field>
      <CommentField
        value={comment()}
        change={setComment}
        input={(element) => commentInput = element}
        disabled={busy()}
      />
      <Button
        variant="secondary"
        disabled={busy() || !comment().trim()}
        onClick={() =>
          void act(async () => {
            await props.transport.request(
              editing()
                ? "artifact.feedback.update"
                : "artifact.feedback.stage",
              {
                sessionId: props.sessionId,
                artifactId: props.artifactId,
                id: editing()?.id,
                quote: quote(),
                comment: comment(),
              },
            );
            setComment("");
            setQuote("");
            setEditing(undefined);
          })}
      >
        {editing() ? "Save comment" : "Stage comment"}
      </Button>
      <Show when={editing()}>
        <p class="text-xs text-muted">Editing feedback for {editing()?.name}</p>
        <Button
          disabled={busy()}
          onClick={() => {
            setEditing(undefined);
            setComment("");
            setQuote("");
          }}
        >
          Cancel edit
        </Button>
      </Show>
      <Show when={error() || draft.error}>
        <p role="alert" class="text-sm text-danger">
          {error() || "Could not load staged feedback."}
        </p>
      </Show>
      <Show when={sent()}>
        <p role="status" class="text-sm text-muted">{sent()}</p>
      </Show>
      <Show when={!draft.error && draft()?.length}>
        <h4 class="text-sm font-medium">Staged comments ({draft()?.length})</h4>
        <ol class="space-y-3">
          <For each={draft.error ? [] : draft()}>
            {(item) => (
              <li class="space-y-2 rounded-lg border border-line p-3">
                <p class="text-xs text-muted">{item.name}</p>
                <Show when={item.quote}>
                  <blockquote class="text-sm text-muted">
                    {item.quote}
                  </blockquote>
                </Show>
                <p class="whitespace-pre-wrap text-sm">{item.comment}</p>
                <div class="flex gap-3">
                  <Button
                    disabled={busy()}
                    onClick={() => {
                      setEditing(item);
                      setQuote(item.quote);
                      setComment(item.comment);
                      commentInput.focus();
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={busy() || editing()?.id === item.id}
                    onClick={() =>
                      void act(async () => {
                        await props.transport.request(
                          "artifact.feedback.remove",
                          { sessionId: props.sessionId, id: item.id },
                        );
                      })}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            )}
          </For>
        </ol>
        <Button
          variant="primary"
          disabled={busy() || !!editing()}
          onClick={() =>
            void act(async () => {
              const result = await props.transport.request<{ sent: number }>(
                "artifact.feedback.send",
                { sessionId: props.sessionId },
              );
              setSent(
                `Sent ${result.sent} comment${
                  result.sent === 1 ? "" : "s"
                } for revision.`,
              );
            })}
        >
          {busy() ? "Working…" : "Send feedback together"}
        </Button>
      </Show>
    </section>
  );
}
