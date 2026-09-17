import { createSignal, Show } from "solid-js";

import { Button, Field, Modal } from "./primitives.tsx";

export function RenameSession(props: {
  title: string;
  save(title: string): Promise<void>;
  close(): void;
}) {
  const [title, setTitle] = createSignal(props.title);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let input!: HTMLInputElement;
  const close = () => {
    if (!busy()) props.close();
  };

  async function save() {
    const next = title().trim();
    if (!next || busy()) return;
    setBusy(true);
    setError("");
    try {
      await props.save(next);
      props.close();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      if (input.isConnected) input.focus();
    }
  }

  return (
    <Modal title="Rename session" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Session name">
          <input
            ref={input}
            autofocus
            value={title()}
            readOnly={busy()}
            onInput={(event) => setTitle(event.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <p role="alert" class="mb-3 text-danger">
            {error()}
          </p>
        </Show>
        <Button type="submit" variant="primary" disabled={!title().trim() || busy()}>
          {busy() ? "Saving…" : "Save name"}
        </Button>
      </form>
    </Modal>
  );
}
