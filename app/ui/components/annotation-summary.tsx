import { Show } from "solid-js";

import { Chip } from "./primitives.tsx";
import { Icon } from "./icon.tsx";

export function AnnotationSummary(props: { count: number }) {
  return (
    <Show when={props.count > 0}>
      <ul
        class="mb-4 flex flex-wrap gap-2"
        aria-label="Attached files and annotations"
      >
        <li>
          <Chip>
            <Icon name="chat-circle-text" />
            {props.count} {props.count === 1 ? "annotation" : "annotations"}
          </Chip>
        </li>
      </ul>
    </Show>
  );
}
