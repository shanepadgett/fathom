import type { SessionState } from "../../sdk/session.ts";
import type { Transport } from "../transport.ts";
import { createEffect, createSignal, For, Show } from "solid-js";
import { Button } from "./primitives.tsx";
import { EditMessage } from "./edit-message.tsx";

export function QueuedMessages(
  props: { state?: SessionState; transport: Transport },
) {
  const [editing, setEditing] = createSignal<
    { id: string; text: string; sessionId: string; projectId: string }
  >();
  const [pending, setPending] = createSignal<
    { id: string; action: "send" | "remove" }
  >();
  const [error, setError] = createSignal("");
  let selectedSession: string | undefined;
  createEffect(() => {
    const id = props.state?.session.id;
    if (id !== selectedSession) {
      selectedSession = id;
      setEditing(undefined);
      setError("");
    }
  });

  async function act(id: string, action: "send" | "remove") {
    if (pending()) return;
    const sessionId = props.state?.session.id;
    const projectId = props.transport.projectId;
    setPending({ id, action });
    setError("");
    try {
      await props.transport.request(
        action === "send" ? "queue.send" : "queue.update",
        {
          projectId,
          sessionId,
          id,
          text: null,
        },
      );
    } catch (error) {
      if (props.state?.session.id === sessionId) {
        setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setPending(undefined);
    }
  }

  return (
    <>
      <Show when={props.state?.queued.length || error()}>
        <div class="pointer-events-auto mb-2 max-h-40 overflow-auto rounded-control border border-line bg-surface p-2 text-sm">
          <For each={props.state?.queued}>
            {(item) => (
              <div class="flex items-center gap-2">
                <p class="min-w-0 flex-1 truncate text-muted" title={item.text}>
                  {item.mode === "steer" ? "Steering" : "Queued"}: {item.text}
                </p>
                <Show when={item.attachments?.length}>
                  <span class="text-xs text-muted">
                    {item.attachments!.length} attached
                  </span>
                </Show>
                <Show
                  when={!["running", "retry_waiting", "approval"].includes(
                    props.state?.session.status ?? "",
                  )}
                >
                  <Button
                    disabled={!!pending()}
                    onClick={() => void act(item.id, "send")}
                  >
                    {pending()?.id === item.id && pending()?.action === "send"
                      ? "Sending…"
                      : "Send now"}
                  </Button>
                </Show>
                <Button
                  disabled={!!pending()}
                  onClick={() =>
                    setEditing({
                      ...item,
                      sessionId: props.state!.session.id,
                      projectId: props.transport.projectId,
                    })}
                >
                  Edit
                </Button>
                <Button
                  disabled={!!pending()}
                  onClick={() => void act(item.id, "remove")}
                >
                  {pending()?.id === item.id && pending()?.action === "remove"
                    ? "Removing…"
                    : "Remove"}
                </Button>
              </div>
            )}
          </For>
          <Show when={error()}>
            <p role="alert" class="text-danger">{error()}</p>
          </Show>
        </div>
      </Show>
      <Show when={editing()}>
        {(item) => (
          <EditMessage
            text={item().text}
            title="Edit queued message"
            description="Update this message before the agent receives it. If it has already left the queue, check the conversation instead."
            submitLabel="Save changes"
            pendingLabel="Saving…"
            close={() => setEditing(undefined)}
            submit={async (text) => {
              const target = item();
              await props.transport.request("queue.update", {
                projectId: target.projectId,
                sessionId: target.sessionId,
                id: target.id,
                text,
              });
            }}
          />
        )}
      </Show>
    </>
  );
}
