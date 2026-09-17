import type { JSX } from "solid-js";

import { Disclosure } from "./disclosure.tsx";
import { Icon } from "./icon.tsx";

export function FeedbackTray(props: { count: number; source: string; children: JSX.Element }) {
  return (
    <div class="mb-3 rounded-lg border border-control-line bg-surface px-3 py-1">
      <Disclosure
        label={
          <span class="inline-flex items-center gap-2">
            <Icon name="chat-circle-text" />
            <span>
              {props.count} staged {props.source} {props.count === 1 ? "comment" : "comments"}
            </span>
          </span>
        }
      >
        {props.children}
      </Disclosure>
    </div>
  );
}
