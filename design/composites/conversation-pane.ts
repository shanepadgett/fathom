import type { Message } from "../models/conversation.ts";
import type { Changes } from "../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./conversation-header.ts";
import "./message-composer.ts";
import "./message-transcript.ts";

export class ConversationPaneElement extends DesignElement {
  static override properties = {
    title: { type: String },
    messages: { attribute: false },
    changes: { attribute: false },
    model: { type: String },
    reasoning: { type: String },
    presentation: { type: String },
  };

  declare title: string;
  declare messages: Message[];
  declare changes: Changes;
  declare model: string;
  declare reasoning: string;
  declare presentation: "main" | "drawer";

  constructor() {
    super();
    this.title = "";
    this.messages = [];
    this.model = "";
    this.reasoning = "";
    this.presentation = "main";
  }

  override render() {
    if (!this.changes) {
      return nothing;
    }
    const { title, messages, changes, model, reasoning, presentation } = this;
    return html`
      <section
        data-component="conversation-pane"
        class="flex min-h-0 min-w-0 flex-1 flex-col"
        aria-label="Agent conversation"
      >
        <conversation-header .title=${title} .presentation=${presentation}></conversation-header>
        <div class="relative grid min-h-0 flex-1 grid-cols-1 conversation-rows">
          <div
            data-conversation-scroll
            class="col-start-1 row-span-2 row-start-1 min-h-0 overflow-y-auto pb-56"
          >
            <message-transcript .messages=${messages} .changes=${changes}></message-transcript>
          </div>
          <div
            data-composer-overlay
            class="relative col-start-1 row-start-2 pb-6 pt-12 before:pointer-events-none before:absolute before:inset-0 before:overlay-glass before:composer-fade"
          >
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 composer-bottom-glass"
            ></div>
            <div class="relative mx-auto w-full max-w-transcript px-6">
              <message-composer .model=${model} .reasoning=${reasoning}></message-composer>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define("conversation-pane", ConversationPaneElement);
