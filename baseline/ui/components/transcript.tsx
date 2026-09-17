import type { Message } from "@earendil-works/pi-ai";

import { For } from "solid-js";

import { ChatMessage } from "./message.tsx";

export function Transcript(props: { messages: Message[] }) {
  return (
    <div
      data-component="transcript"
      class="mx-auto w-full max-w-transcript flex flex-col gap-8 px-6 py-8"
    >
      <For each={props.messages}>{(item) => <ChatMessage item={item} />}</For>
    </div>
  );
}
