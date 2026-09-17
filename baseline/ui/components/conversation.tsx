import type { ModelChoice, SessionSnapshot } from "../../types.ts";

import { Composer } from "./composer.tsx";
import { Transcript } from "./transcript.tsx";

export function Conversation(props: {
  mode?: "agent" | "chat";
  snapshot?: SessionSnapshot;
  models: ModelChoice[];
  onSend(text: string): void;
  onStop(): void;
  onModel(choice: { provider: string; model: string }): void;
}) {
  const title = () => props.snapshot?.title ?? "New chat";
  return (
    <section
      data-component="conversation-pane"
      class="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label={props.mode === "chat" ? "Chat conversation" : "Agent conversation"}
    >
      <header class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-6">
        <h2 class="min-w-0 truncate font-medium" title={title()}>
          {title()}
        </h2>
        <ds-button variant="quiet" size="small" icon-only>
          <button type="button" aria-label="Conversation options" title="Conversation options">
            <i class="ph ph-dots-three shrink-0 text-base" aria-hidden="true" />
          </button>
        </ds-button>
      </header>
      <div class="relative grid min-h-0 flex-1 grid-cols-1 conversation-rows">
        <div
          data-conversation-scroll
          class="col-start-1 row-span-2 row-start-1 min-h-0 overflow-y-auto pb-56"
        >
          <Transcript messages={props.snapshot?.messages ?? []} />
        </div>
        <div
          data-composer-overlay
          class="pointer-events-none relative col-start-1 row-start-2 pb-6 pt-12 before:absolute before:inset-y-0 before:left-0 before:right-6 before:overlay-glass before:composer-fade"
        >
          <div aria-hidden="true" class="absolute inset-y-0 left-0 right-6 composer-bottom-glass" />
          <div class="relative mx-auto w-full max-w-transcript px-6">
            <div class="pointer-events-auto">
              <Composer
                snapshot={props.snapshot}
                models={props.models}
                sending={props.snapshot?.status === "running"}
                onSend={props.onSend}
                onStop={props.onStop}
                onModel={props.onModel}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
