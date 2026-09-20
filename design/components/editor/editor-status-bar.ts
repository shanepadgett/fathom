import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";

export class EditorStatusBarElement extends DesignElement {
  override render() {
    return html`
      <div
        class="flex justify-between gap-3 border-t border-line px-4 py-2 text-xs text-muted">
        <span>Problems <span class="ml-3 text-warning">1 warning</span></span
        ><span>Ln 18, Col 3 · UTF-8 · TypeScript</span>
      </div>
    `;
  }
}

customElements.define("editor-status-bar", EditorStatusBarElement);
