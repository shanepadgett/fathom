import { createSignal, Show } from "solid-js";

import { Button } from "./primitives.tsx";

export function ArtifactApproval(props: {
  disabled?: boolean;
  approve(): Promise<unknown>;
  approved?(): void;
}) {
  const [busy, setBusy] = createSignal(false);
  const [complete, setComplete] = createSignal(false);
  const [error, setError] = createSignal("");
  async function approve() {
    if (busy() || complete() || props.disabled) return;
    setBusy(true);
    setError("");
    try {
      await props.approve();
      setComplete(true);
      props.approved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="space-y-2">
      <Button
        variant="primary"
        disabled={props.disabled || busy() || complete()}
        onClick={() => void approve()}
      >
        {busy() ? "Approving…" : complete() ? "Approved" : "Approve & proceed"}
      </Button>
      <Show when={error()}>
        <p role="alert" class="text-sm text-danger">
          {error()}
        </p>
      </Show>
    </div>
  );
}
