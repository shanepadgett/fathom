import type { ModelChoice, SessionSnapshot } from "../../types.ts";

import { For } from "solid-js";

export function Composer(props: {
  snapshot?: SessionSnapshot;
  models: ModelChoice[];
  sending: boolean;
  onSend(text: string): void;
  onStop(): void;
  onModel(choice: { provider: string; model: string }): void;
}) {
  let field!: HTMLTextAreaElement;
  const running = () => props.snapshot?.status === "running";
  const label = () => {
    const snapshot = props.snapshot;
    if (!snapshot?.model) return "Choose model";
    const match = props.models.find(
      (model) => model.provider === snapshot.provider && model.id === snapshot.model,
    );
    return match?.name ?? snapshot.model;
  };
  return (
    <div data-component="composer" class="rounded-lg border border-line bg-surface p-4">
      <textarea
        ref={field}
        class="min-h-12 w-full resize-none bg-transparent text-ink outline-none placeholder:text-muted"
        placeholder="Ask a follow-up or steer the current run…"
        rows={2}
        disabled={!props.snapshot || props.sending}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = field.value.trim();
            if (!text || running()) return;
            field.value = "";
            props.onSend(text);
          }
        }}
      />
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <ds-button variant="quiet">
          <button type="button" aria-label="Attach context" disabled>
            <i class="ph ph-plus shrink-0 text-base" aria-hidden="true" />
            Attach context
          </button>
        </ds-button>
        <span class="ml-auto flex flex-wrap items-center gap-3">
          <ds-button>
            <button type="button" class="relative" aria-label={label()}>
              <span>{label()}</span>
              <i class="ph ph-caret-down shrink-0 text-xs" aria-hidden="true" />
              <select
                class="absolute inset-0 cursor-pointer opacity-0"
                disabled={!props.snapshot}
                value={`${props.snapshot?.provider ?? ""}:${props.snapshot?.model ?? ""}`}
                onChange={(event) => {
                  const [provider, ...rest] = event.currentTarget.value.split(":");
                  props.onModel({ provider, model: rest.join(":") });
                }}
              >
                <For each={props.models}>
                  {(model) => <option value={`${model.provider}:${model.id}`}>{model.name}</option>}
                </For>
              </select>
            </button>
          </ds-button>
          <ds-button>
            <button
              type="button"
              aria-label={running() ? "Stop" : "Send"}
              disabled={!props.snapshot}
              onClick={() => {
                if (running()) {
                  props.onStop();
                  return;
                }
                const text = field.value.trim();
                if (!text) return;
                field.value = "";
                props.onSend(text);
              }}
            >
              {running() ? (
                <>
                  Stop <i class="ph ph-stop shrink-0 text-xs" aria-hidden="true" />
                </>
              ) : (
                "Send"
              )}
            </button>
          </ds-button>
        </span>
      </div>
    </div>
  );
}
