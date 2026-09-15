import type { Entry } from "../../sdk/session.ts";

import { Show } from "solid-js";

export function ResponseStatus(props: { entry: Entry }) {
  const status = () => {
    const message = props.entry.message;
    if (message?.role !== "assistant" || props.entry.status === "pending") {
      return;
    }
    if (
      props.entry.status === "interrupted" || message.stopReason === "aborted"
    ) {
      return {
        error: false,
        text: "Response interrupted. Partial output is preserved.",
      };
    }
    if (props.entry.status === "error" || message.stopReason === "error") {
      return {
        error: true,
        text: message.errorMessage ||
          "The provider could not complete this response.",
      };
    }
    if (message.stopReason === "length") {
      return {
        error: false,
        text: "Response reached its output limit. Continue to resume.",
      };
    }
  };
  return (
    <Show when={status()}>
      {(value) => (
        <p
          role="status"
          class={`text-sm ${value().error ? "text-danger" : "text-muted"}`}
        >
          {value().text}
        </p>
      )}
    </Show>
  );
}
