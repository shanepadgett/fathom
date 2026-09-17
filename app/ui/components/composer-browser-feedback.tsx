import type { Transport } from "../transport.ts";

import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";

import { browserFeedback } from "../state/browser-feedback.ts";
import { FeedbackTray } from "./feedback-tray.tsx";
import { Button } from "./primitives.tsx";
import { StagedFeedbackList } from "./staged-feedback-list.tsx";

export function ComposerBrowserFeedback(props: {
  transport: Transport;
  sessionId: string;
  disabled?: boolean;
  working(value: boolean): void;
}) {
  const { draft, refetch } = browserFeedback(props.transport, () => props.sessionId);
  const [editing, setEditing] = createSignal(false);
  const [busy, setBusy] = createSignal<"clear" | "submit">();
  const [error, setError] = createSignal("");
  createEffect(
    on(
      () => props.sessionId,
      () => setError(""),
    ),
  );
  createEffect(() => props.working(!!busy() || editing()));
  onCleanup(() => props.working(false));
  async function act(action: "clear" | "submit") {
    if (busy() || editing() || props.disabled) return;
    const sessionId = props.sessionId;
    setBusy(action);
    setError("");
    try {
      await props.transport.request(`annotations.${action}`, { sessionId });
      if (sessionId === props.sessionId) await refetch();
    } catch (cause) {
      if (sessionId === props.sessionId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <>
      <Show when={error() || draft.error}>
        <p role="alert" class="mb-3 text-sm text-danger">
          {error() || "Could not load browser feedback."}
          <Show when={draft.error}>
            <Button onClick={() => void Promise.resolve(refetch()).catch(() => {})}>Retry</Button>
          </Show>
        </p>
      </Show>
      <Show when={!draft.error && draft()?.length}>
        <FeedbackTray count={draft()?.length ?? 0} source="browser">
          <StagedFeedbackList
            sessionId={props.sessionId}
            source="browser"
            items={(draft.error ? [] : (draft() ?? [])).map((item) => ({
              ...item,
              label: item.url,
            }))}
            disabled={!!busy() || props.disabled}
            working={setEditing}
            save={async (sessionId, item) => {
              await props.transport.request("annotations.update", {
                sessionId,
                id: item.id,
                comment: item.comment,
              });
              if (sessionId === props.sessionId) await refetch();
            }}
            remove={async (sessionId, id) => {
              await props.transport.request("annotations.remove", {
                sessionId,
                id,
              });
              if (sessionId === props.sessionId) await refetch();
            }}
          />
          <div class="flex gap-3 pb-2">
            <Button
              disabled={!!busy() || editing() || props.disabled}
              onClick={() => void act("clear")}
            >
              {busy() === "clear" ? "Clearing…" : "Clear browser feedback"}
            </Button>
            <Button
              variant="primary"
              disabled={!!busy() || editing() || props.disabled}
              onClick={() => void act("submit")}
            >
              {busy() === "submit" ? "Sending…" : "Send browser feedback"}
            </Button>
          </div>
        </FeedbackTray>
      </Show>
    </>
  );
}
