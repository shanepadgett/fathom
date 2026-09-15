import { createSignal, onCleanup, Show } from "solid-js";

import { Button } from "./primitives.tsx";

export function MessageActions(props: {
  text: string;
  link: string;
  disabled: boolean;
  edit?: () => void;
  retry?: () => Promise<void>;
  branch?: () => void;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [linkCopied, setLinkCopied] = createSignal(false);
  let feedback: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(feedback));
  async function act(action: () => void | Promise<void>) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    await navigator.clipboard.writeText(props.text);
    setLinkCopied(false);
    setCopied(true);
    clearTimeout(feedback);
    feedback = setTimeout(() => setCopied(false), 2000);
  }
  return (
    <>
      <div
        class="mt-4 flex flex-wrap gap-1"
        role="group"
        aria-label="Message actions"
      >
        <Show when={props.text.trim()}>
          <Button
            disabled={busy()}
            title="Copy message"
            onClick={() => void act(copy)}
          >
            {copied() ? "Copied" : "Copy"}
          </Button>
        </Show>
        <Show when={props.edit}>
          <Button
            disabled={busy() || props.disabled}
            onClick={() => void act(props.edit!)}
          >
            Edit and resend
          </Button>
        </Show>
        <Show when={props.retry}>
          <Button
            disabled={busy() || props.disabled}
            onClick={() => void act(props.retry!)}
          >
            Retry response
          </Button>
        </Show>
        <Show when={props.branch}>
          <Button
            disabled={busy() || props.disabled}
            onClick={() => void act(props.branch!)}
          >
            Branch from here
          </Button>
        </Show>
        <Button
          disabled={busy()}
          onClick={() =>
            void act(async () => {
              await navigator.clipboard.writeText(props.link);
              setLinkCopied(true);
              setCopied(false);
              clearTimeout(feedback);
              feedback = setTimeout(() => setLinkCopied(false), 2000);
            })}
        >
          {linkCopied() ? "Copied link" : "Copy message link"}
        </Button>
      </div>
      <Show when={error()}>
        <p role="alert" class="mt-2 text-sm text-danger">{error()}</p>
      </Show>
    </>
  );
}
