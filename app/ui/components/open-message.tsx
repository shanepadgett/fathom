import { createSignal, Show } from "solid-js";

import { Button, Field, Modal } from "./primitives.tsx";

export function OpenMessage(props: { open(link: string): Promise<void>; close(): void }) {
  const [link, setLink] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy() || !link().trim()) return;
    setBusy(true);
    setError("");
    try {
      await props.open(link());
      props.close();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Open message link" close={props.close}>
      <form class="space-y-4" onSubmit={(event) => void submit(event)}>
        <Field label="Message link" hint="Open a message from a project stored on this machine.">
          <input
            autofocus
            required
            value={link()}
            disabled={busy()}
            placeholder="fathom://message/…"
            onInput={(event) => setLink(event.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <p role="alert" class="text-sm text-danger">
            {error()}
          </p>
        </Show>
        <Button type="submit" variant="primary" disabled={busy() || !link().trim()}>
          {busy() ? "Opening…" : "Open message"}
        </Button>
      </form>
    </Modal>
  );
}
