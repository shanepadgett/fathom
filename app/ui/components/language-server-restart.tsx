import type { Transport } from "../transport.ts";

import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { Button } from "./primitives.tsx";

/** Project-scoped recovery action, reusable outside the inspector. */
export function LanguageServerRestart(props: {
  transport: Transport;
  projectId?: string;
  id: string;
  name: string;
  disabled?: boolean;
  failure?: string;
}) {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal("");
  let generation = 0;
  createEffect(() => {
    props.projectId;
    props.id;
    ++generation;
    setPending(false);
    setError("");
  });
  onCleanup(() => ++generation);

  async function restart() {
    const projectId = props.projectId;
    if (!projectId || props.disabled || pending()) return;
    const current = generation;
    setPending(true);
    setError("");
    try {
      await props.transport.request("lsp.restart", { projectId, id: props.id });
    } catch (cause) {
      if (current === generation) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (current === generation) setPending(false);
    }
  }

  return (
    <div class="space-y-2" aria-busy={pending()}>
      <Button
        variant="quiet"
        disabled={!props.projectId || props.disabled || pending()}
        aria-label={`Restart ${props.name}`}
        onClick={() => void restart()}
      >
        {pending() ? "Restarting…" : "Restart"}
      </Button>
      <Show when={error() || props.failure}>
        <p role="alert" class="text-sm text-danger">
          {error() || props.failure}
        </p>
      </Show>
    </div>
  );
}
