import type { ContextMenuSection } from "../models/context-menu.ts";

import { html, nothing } from "lit";

import { icon } from "../primitives/icon.ts";
import "./button.ts";
import { DesignElement } from "./design-element.ts";

/** Segmented action surface; owners provide content and handle simulated actions. */
export class ContextMenuElement extends DesignElement {
  static override properties = {
    sections: { attribute: false },
    label: { type: String },
    preview: { type: Boolean },
  };

  declare sections: ContextMenuSection[];
  declare label: string;
  declare preview: boolean;

  constructor() {
    super();
    this.sections = [];
    this.label = "Options";
    this.preview = false;
  }

  private keydown(event: KeyboardEvent) {
    const buttons = [...this.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
    if (event.key === "Escape" && !this.preview) {
      this.querySelector<HTMLElement>("[role=menu]")?.hidePopover();
    }
  }

  private choose(id: string) {
    this.dispatchEvent(new CustomEvent("menu-action", { detail: { id }, bubbles: true }));
    if (!this.preview) {
      this.querySelector<HTMLElement>("[role=menu]")?.hidePopover();
    }
  }

  override render() {
    return html`<div
      class="context-menu"
      role="menu"
      aria-label=${this.label}
      popover=${this.preview ? nothing : "auto"}
      @keydown=${this.keydown}
    >
      ${this.sections.map(
        (
          section,
          index,
        ) => html` ${index ? html`<div role="separator" class="my-1 border-t border-line"></div>` : nothing}
          <div role="group">
            ${section.map(
              (item) => html` <div class="flex items-center gap-1">
                <ds-button variant="quiet"
                  ><button
                    class="context-menu-action"
                    type="button"
                    role="menuitem"
                    @click=${() => this.choose(item.id)}
                  >
                    ${icon(item.icon)}<span>${item.label}</span>
                  </button></ds-button
                >
                ${
                  item.agentAction
                    ? html`<ds-button variant="quiet" size="small" icon-only
                        ><button
                          type="button"
                          role="menuitem"
                          aria-label="Rename with agent"
                          title="Rename with agent"
                          @click=${() => this.choose("rename-agent")}
                        >
                          ${icon("robot")}
                        </button></ds-button
                      >`
                    : nothing
                }
              </div>`,
            )}
          </div>`,
      )}
    </div>`;
  }
}

customElements.define("ds-context-menu", ContextMenuElement);
