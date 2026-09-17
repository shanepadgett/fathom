import type { Message } from "@earendil-works/pi-ai";

import { For, Show } from "solid-js";

export function ChatMessage(props: { item: Message }) {
  const agent = () => props.item.role === "assistant";
  const author = () =>
    props.item.role === "user"
      ? "You"
      : props.item.role === "toolResult"
        ? props.item.toolName
        : "Fathom";
  return (
    <article class="min-w-0 break-words">
      <header class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 class={`min-w-0 break-words font-semibold ${agent() ? "text-action" : ""}`}>
          {author()}
        </h3>
        <Show when={agent() && "model" in props.item && props.item.model}>
          {(model) => <span class="text-sm text-muted">{model()}</span>}
        </Show>
        <span class="text-sm text-muted">{time(props.item.timestamp)}</span>
      </header>
      <div class="space-y-4">
        <Show when={props.item.role === "toolResult"} fallback={<Blocks item={props.item} />}>
          <p class="text-sm text-muted whitespace-pre-wrap">
            {props.item.role === "toolResult"
              ? props.item.content
                  .map((block) => (block.type === "text" ? block.text : ""))
                  .join("")
              : ""}
          </p>
        </Show>
      </div>
    </article>
  );
}

function Blocks(props: { item: Message }) {
  if (props.item.role === "user") {
    return <p class="whitespace-pre-wrap">{plain(props.item.content)}</p>;
  }
  if (props.item.role !== "assistant") return null;
  return (
    <For each={props.item.content}>
      {(block) => {
        if (block.type === "text") {
          return <p class="whitespace-pre-wrap">{block.text}</p>;
        }
        if (block.type === "thinking") {
          return <p class="text-sm text-muted whitespace-pre-wrap">{block.thinking}</p>;
        }
        if (block.type === "toolCall") {
          return <p class="text-sm text-muted">{block.name}</p>;
        }
        return null;
      }}
    </For>
  );
}

function plain(content: string | { type: string; text?: string }[]) {
  if (typeof content === "string") return content;
  return content.map((block) => (block.type === "text" ? (block.text ?? "") : "")).join("");
}

function time(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
