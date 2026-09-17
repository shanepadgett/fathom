import { createSignal, Show } from "solid-js";

import { Button, Field, Modal } from "./primitives.tsx";

export function EditMessage(props: {
  text: string;
  submit(text: string): Promise<void>;
  close(): void;
  title?: string;
  description?: string;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const [text, setText] = createSignal(props.text);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function send() {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      await props.submit(text());
      props.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={props.title ?? "Edit and resend"}
      close={() => {
        if (!busy()) props.close();
      }}
      wide
    >
      <p class="mb-4 text-sm text-muted">
        {props.description ??
          "Send an edited prompt from this point. The original conversation remains available in branches. Workspace files stay as they are."}
      </p>
      <Field label="Message">
        <textarea
          class="min-h-40"
          autofocus
          readOnly={busy()}
          maxLength={200_000}
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
        />
      </Field>
      <Show when={error()}>
        <p role="alert" class="my-3 text-danger">
          {error()}
        </p>
      </Show>
      <div class="mt-4 flex justify-end gap-3">
        <Button disabled={busy()} onClick={props.close}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy() || !text().trim()} onClick={() => void send()}>
          {busy()
            ? (props.pendingLabel ?? "Sending…")
            : (props.submitLabel ?? "Send edited message")}
        </Button>
      </div>
    </Modal>
  );
}
