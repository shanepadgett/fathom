import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { drawerControl } from "../workspace/drawer-control.ts";
import { iconButton } from "../../primitives/icon-button.ts";

export class ConversationHeaderElement extends DesignElement {
  static override properties = {
    title: { type: String },
    presentation: { type: String },
  };

  declare title: string;
  declare presentation: "main" | "drawer";

  constructor() {
    super();
    this.title = "";
    this.presentation = "main";
  }

  override render() {
    const { title, presentation } = this;
    return html`
      <header
        class="flex shrink-0 items-center justify-between gap-3 border-b border-line ${
          presentation === "main" ? "h-12 px-6" : "h-12 pl-6 text-sm"
        }"
      >
        <h2 class="min-w-0 truncate font-medium" title="${title}">${title}</h2>
        ${
          presentation === "main"
            ? iconButton("dots-three", "Conversation options")
            : drawerControl("agent", true)
        }
      </header>
    `;
  }
}

customElements.define("conversation-header", ConversationHeaderElement);
