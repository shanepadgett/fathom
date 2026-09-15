import { html } from "lit";

import { button } from "../primitives/button.ts";

export function messageActions(author: "user" | "agent", pending = false) {
  return html`<div class="mt-4 flex flex-wrap gap-1" role="group" aria-label="Message actions">
    ${button({ label: "Copy", variant: "quiet" })}
    ${button({ label: author === "user" ? "Edit and resend" : "Retry response", variant: "quiet", disabled: pending })}
    ${button({ label: "Branch from here", variant: "quiet", disabled: pending })}
    ${button({ label: "Copy message link", variant: "quiet" })}
  </div>`;
}
