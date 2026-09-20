import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { shortcutHint } from "../../primitives/shortcut-hint.ts";

export class KeyboardHintBarElement extends DesignElement {
  static override properties = { action: { type: String } };
  declare action: string;

  constructor() {
    super();
    this.action = "";
  }

  override render() {
    const { action } = this;
    return html`
      <footer
        class="flex h-9 items-center gap-4 border-t border-line bg-surface px-4 text-micro text-muted"
      >
        ${shortcutHint(
          ["\u2191", "\u2193"],
          "Navigate",
        )}${shortcutHint(["Enter"], action)}${shortcutHint(["Esc"], "Close")}
      </footer>
    `;
  }
}

customElements.define("keyboard-hint-bar", KeyboardHintBarElement);
