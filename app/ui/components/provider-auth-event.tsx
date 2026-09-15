import type { AuthEvent } from "@earendil-works/pi-ai";
import { createMemo, For, Show } from "solid-js";

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function ProviderAuthEvent(props: { event: AuthEvent }) {
  const data = createMemo(() => {
    const event = props.event;
    return {
      message: "message" in event ? event.message : undefined,
      instructions: event.type === "auth_url" ? event.instructions : undefined,
      code: event.type === "device_code" ? event.userCode : undefined,
      links: event.type === "info"
        ? event.links ?? []
        : event.type === "auth_url"
        ? [{ url: event.url, label: "Open provider sign-in ↗" }]
        : event.type === "device_code"
        ? [{ url: event.verificationUri, label: "Open provider sign-in ↗" }]
        : [],
    };
  });
  return (
    <div>
      <Show when={data().message}>{(message) => <p>{message()}</p>}</Show>
      <For each={data().links}>
        {(link) => (
          <Show when={safeUrl(link.url)}>
            {(url) => (
              <a
                class="block"
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label || "Open provider instructions ↗"}
              </a>
            )}
          </Show>
        )}
      </For>
      <Show when={data().code}>{(code) => <pre>{code()}</pre>}</Show>
      <Show when={data().instructions}>
        {(instructions) => <p>{instructions()}</p>}
      </Show>
    </div>
  );
}
