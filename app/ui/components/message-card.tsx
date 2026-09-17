import type { JSX } from "solid-js";

import { MessageHeader } from "./message-header.tsx";

export function MessageCard(props: {
  author: string;
  agent: boolean;
  working: boolean;
  model?: string;
  createdAt: number;
  ref?: (element: HTMLElement) => void;
  children: JSX.Element;
}) {
  return (
    <article ref={props.ref} tabIndex={-1} class="group min-w-0 break-words scroll-mt-6">
      <MessageHeader
        author={props.author}
        agent={props.agent}
        working={props.working}
        model={props.model}
        createdAt={props.createdAt}
      />
      {props.children}
    </article>
  );
}
