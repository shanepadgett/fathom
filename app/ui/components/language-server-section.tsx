import type { Transport } from "../transport.ts";

import { For, Show } from "solid-js";

import { createLanguageServers } from "../state/language-server.ts";
import { InspectorSection } from "./inspector-section.tsx";
import { LanguageServerRestart } from "./language-server-restart.tsx";

export function LanguageServerSection(props: { transport: Transport; projectId?: string }) {
  const servers = createLanguageServers(props.transport, () => props.projectId);
  const count = (key: "errors" | "warnings") =>
    servers()?.reduce((total, server) => total + server[key], 0) ?? 0;
  return (
    <InspectorSection title="Language servers">
      <div class="flex flex-col gap-3">
        <Show when={servers()} fallback={<p class="text-muted">Loading…</p>}>
          <For
            each={servers()?.map((server) => server.id)}
            fallback={<p class="text-muted">No language servers registered.</p>}
          >
            {(id) => {
              const status = () => servers()?.find((server) => server.id === id);
              return (
                <div class="space-y-2">
                  <p class="flex justify-between gap-3" title={status()?.error}>
                    {status()?.name}
                    <span
                      class={
                        status()?.running
                          ? "text-success"
                          : status()?.state === "starting"
                            ? "text-muted"
                            : "text-warning"
                      }
                    >
                      {status()?.running
                        ? "Connected"
                        : status()?.state === "starting"
                          ? "Starting…"
                          : "Unavailable"}
                    </span>
                  </p>
                  <Show when={Object.keys(status()?.languages ?? {}).length}>
                    <LanguageServerRestart
                      transport={props.transport}
                      projectId={props.projectId}
                      id={id}
                      name={status()?.name ?? id}
                      failure={status()?.error}
                      disabled={status()?.state === "starting"}
                    />
                  </Show>
                  <Show when={!Object.keys(status()?.languages ?? {}).length && status()?.error}>
                    <p role="alert" class="text-sm text-danger">
                      {status()?.error}
                    </p>
                  </Show>
                </div>
              );
            }}
          </For>
          <Show when={servers()?.some((server) => server.running)}>
            <p class="text-muted">
              {count("errors")} {count("errors") === 1 ? "error" : "errors"} · {count("warnings")}{" "}
              {count("warnings") === 1 ? "warning" : "warnings"}
            </p>
          </Show>
        </Show>
      </div>
    </InspectorSection>
  );
}
