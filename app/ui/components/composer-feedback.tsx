import type { Transport } from "../transport.ts";

import { createEffect, createSignal, on, Show } from "solid-js";

import { artifactFeedback } from "../state/artifact-feedback.ts";
import { ComposerBrowserFeedback } from "./composer-browser-feedback.tsx";
import { FeedbackTray } from "./feedback-tray.tsx";
import { Button } from "./primitives.tsx";
import { StagedFeedbackList } from "./staged-feedback-list.tsx";

export function ComposerFeedback(props: {
  transport: Transport;
  sessionId: string;
  openArtifact(id: string): void;
}) {
  const feedback = artifactFeedback(props.transport, () => props.sessionId);
  const [editing, setEditing] = createSignal(false);
  const [browserEditing, setBrowserEditing] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal("");
  createEffect(
    on(
      () => props.sessionId,
      () => setError(""),
    ),
  );
  async function sendAll() {
    if (sending() || editing() || browserEditing()) return;
    const sessionId = props.sessionId;
    setSending(true);
    setError("");
    try {
      await props.transport.request("feedback.send", { sessionId });
      if (sessionId === props.sessionId) await feedback.refetch();
    } catch (cause) {
      if (sessionId === props.sessionId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <ComposerBrowserFeedback
        transport={props.transport}
        sessionId={props.sessionId}
        disabled={sending() || editing()}
        working={setBrowserEditing}
      />
      <Show when={error()}>
        <p role="alert" class="mb-3 text-sm text-danger">
          {error()}
        </p>
      </Show>
      <Show when={feedback.draft.error}>
        <p role="alert" class="mb-3 text-sm text-danger">
          Could not load staged feedback.{" "}
          <Button onClick={() => void Promise.resolve(feedback.refetch()).catch(() => {})}>
            Retry
          </Button>
        </p>
      </Show>
      <Show when={!feedback.draft.error && feedback.draft()?.length}>
        <FeedbackTray count={feedback.draft()?.length ?? 0} source="artifact">
          <StagedFeedbackList
            sessionId={props.sessionId}
            source="artifact"
            items={(feedback.draft.error ? [] : (feedback.draft() ?? [])).map((item) => ({
              ...item,
              label: item.name,
            }))}
            disabled={sending() || browserEditing()}
            working={setEditing}
            save={async (sessionId, item) => {
              await props.transport.request("artifact.feedback.update", {
                sessionId,
                id: item.id,
                quote: item.quote ?? "",
                comment: item.comment,
              });
              if (sessionId === props.sessionId) await feedback.refetch();
            }}
            remove={async (sessionId, id) => {
              await props.transport.request("artifact.feedback.remove", {
                sessionId,
                id,
              });
              if (sessionId === props.sessionId) await feedback.refetch();
            }}
            review={(id) => {
              const item = feedback.draft()?.find((item) => item.id === id);
              if (item) props.openArtifact(item.artifactId);
            }}
          />
          <Button
            variant="primary"
            disabled={sending() || editing() || browserEditing()}
            onClick={() => void sendAll()}
          >
            {sending() ? "Sending…" : "Send all staged feedback"}
          </Button>
        </FeedbackTray>
      </Show>
    </>
  );
}
