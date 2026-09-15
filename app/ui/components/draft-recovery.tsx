import type { EditorDocument } from "./editor-engine.ts";

import { createSignal, For, Show } from "solid-js";

import { Button, Modal } from "./primitives.tsx";

export interface RecoveredDraft {
  path?: string;
  text: string;
  error?: string;
}

export function DraftRecovery(props: {
  drafts: RecoveredDraft[];
  recover(path: string, destination: string): Promise<EditorDocument>;
  restored(draft: RecoveredDraft, document: EditorDocument): void;
  close(): void;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  return (
    <Modal
      title="Recovered drafts"
      close={() => {
        if (!busy()) props.close();
      }}
    >
      <p>
        Save each draft to a new file in this workspace, or copy its text.
        Existing files will not be replaced.
      </p>
      <For each={props.drafts}>
        {(draft) => {
          const [destination, setDestination] = createSignal(draft.path ?? "");
          const recover = async () => {
            setBusy(true);
            setError("");
            try {
              props.restored(
                draft,
                await props.recover(draft.path ?? "", destination()),
              );
            } catch (error) {
              setError(String(error));
            } finally {
              setBusy(false);
            }
          };
          return (
            <section class="mt-4">
              <h3 class="mb-3 font-medium">{draft.path}</h3>
              <textarea
                readonly
                aria-label={`Recovered draft for ${draft.path}`}
                class="h-40 w-full font-mono"
                value={draft.text}
              />
              <label class="mt-3 block">
                Save to workspace path<input
                  class="mt-2 w-full"
                  value={destination()}
                  disabled={busy()}
                  onInput={(event) => setDestination(event.currentTarget.value)}
                />
              </label>
              <div class="actions">
                <Button
                  disabled={busy()}
                  onClick={() =>
                    void navigator.clipboard.writeText(draft.text).catch(
                      (error) => setError(String(error)),
                    )}
                >
                  Copy draft
                </Button>
                <Button
                  variant="primary"
                  disabled={busy() || !destination().trim()}
                  onClick={() => void recover()}
                >
                  {busy() ? "Saving…" : "Save recovered file"}
                </Button>
              </div>
            </section>
          );
        }}
      </For>
      <Show when={error()}>
        <p role="alert" class="error">{error()}</p>
      </Show>
    </Modal>
  );
}
