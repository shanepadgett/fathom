import type { Chat, Project } from "../models/session.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";
import { branchIdentity } from "./branch-identity.ts";
import { projectIdentity } from "./project-identity.ts";

function sessionStatus(chat: Chat, selected: boolean) {
  const unread = chat.unread && !selected;
  const state =
    chat.activity === "running"
      ? ({ label: chat.status ?? "Working", symbol: "spinner-gap", tone: "text-action" } as const)
      : chat.activity === "attention"
        ? ({ label: "Needs your input", symbol: "chat-circle-text", tone: "text-warning" } as const)
        : chat.activity === "completed" && unread
          ? ({ label: "Completed · Unread", symbol: "check", tone: "text-success" } as const)
          : ({ label: "Idle", symbol: "moon", tone: "text-muted" } as const);
  return html`<span
    role="img"
    aria-label=${state.label}
    title=${state.label}
    class="ml-auto inline-flex shrink-0 ${state.tone}"
    ><span
      class="inline-flex ${chat.activity === "running" ? "motion-safe:animate-session-spin" : ""}"
      >${icon(state.symbol, "small")}</span
    ></span
  >`;
}

export class ChatListItemElement extends DesignElement {
  static override properties = {
    mode: { type: String },
    chat: { attribute: false },
    project: { attribute: false },
    selected: { type: Boolean },
  };

  declare chat: Chat;
  declare project: Project | undefined;
  declare mode: "agent" | "chat";
  declare selected: boolean;

  constructor() {
    super();
    this.mode = "agent";
    this.selected = false;
  }

  override render() {
    if (!this.chat) {
      return nothing;
    }
    if (this.mode === "chat") {
      const { chat, selected } = this;
      const unread = chat.unread && !selected;
      return html`<div
        tabindex="0"
        aria-haspopup="menu"
        data-chat-item
        class="min-w-0 rounded-control px-2 py-1.5 ${selected ? "bg-action/10" : "hover:bg-canvas"}"
        aria-current=${selected ? "true" : nothing}
      >
        <div class="flex min-w-0 items-baseline gap-2">
          <p
            class="min-w-0 flex-1 truncate text-dense ${selected ? "text-action" : "text-ink"} ${unread ? "font-medium" : ""}"
            title=${chat.title}
          >
            ${chat.title}
          </p>
        </div>
        <div class="mt-0.5 flex min-w-0 items-center justify-between gap-2 text-micro">
          <span class="shrink-0 text-muted">${chat.time}</span>
          ${sessionStatus(chat, selected)}
        </div>
      </div>`;
    }
    if (!this.project) {
      return nothing;
    }
    const { chat, project, selected } = this;
    return html`
      <div
        tabindex="0"
        aria-haspopup="menu"
        data-chat-item
        class="min-w-0 rounded-control px-2 py-2 ${selected ? "bg-action/10" : "hover:bg-canvas"}"
        aria-current=${selected ? "true" : nothing}
      >
        <div class="flex items-center justify-between gap-1.5 text-micro text-muted">
          ${projectIdentity(project.name)}<span class="shrink-0">${chat.time}</span>
        </div>
        <p
          class="mt-1 truncate text-dense ${selected ? "text-action" : "text-ink"}"
          title="${chat.title}"
        >
          ${chat.title}
        </p>
        <div class="mt-1 flex min-w-0 items-center justify-between gap-1.5 text-micro text-muted">
          ${chat.branch ? branchIdentity(chat.branch) : nothing}${sessionStatus(chat, selected)}
        </div>
      </div>
    `;
  }
}

customElements.define("chat-list-item", ChatListItemElement);
