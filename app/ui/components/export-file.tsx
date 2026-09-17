import { createSignal, Show } from "solid-js";

import { Button, Field, Modal } from "./primitives.tsx";

export function ExportFile(props: {
  name: string;
  save(path: string): Promise<void>;
  close(): void;
}) {
  const [path, setPath] = createSignal(props.name);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy() || !path().trim()) return;
    setBusy(true);
    setError("");
    try {
      await props.save(path().trim());
      props.close();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Save to workspace" close={props.close}>
      <form class="space-y-4" onSubmit={(event) => void save(event)}>
        <Field
          label="Destination path"
          hint="Choose a new path in this workspace. Existing files are preserved."
        >
          <input
            autofocus
            required
            value={path()}
            disabled={busy()}
            onInput={(event) => setPath(event.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <p role="alert" class="text-sm text-danger">
            {error()}
          </p>
        </Show>
        <Button type="submit" variant="primary" disabled={busy() || !path().trim()}>
          {busy() ? "Saving…" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
