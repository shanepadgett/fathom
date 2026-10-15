import type { InspectorData } from "../../models/inspector.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { iconButton } from "../../primitives/icon-button.ts";
import "./inspector-section.ts";
import "./language-server-item.ts";
import "../../primitives/metric-list.ts";
import { folderStatus, serviceStatus } from "./workspace-resources.ts";

export class SessionInspectorElement extends DesignElement {
  static override properties = { data: { attribute: false } };
  declare data: InspectorData;

  override render() {
    if (!this.data) {
      return nothing;
    }
    const { data } = this;
    return html`
      <header
        class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4 font-medium"
      >
        <span>Session</span>${iconButton("x", "Close session panel")}
      </header>
      <div
        data-inspector-content
        class="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4 p-4 text-sm"
      >
        ${data.folders?.length
          ? html`
            <inspector-section
              .title=${`Folders \u00b7 ${data.folders.length}`}
              .content=${html`
                <div class="flex flex-col gap-3">
                  ${data.folders.map(folderStatus)}
                </div>
              `}
              .first=${true}
            ></inspector-section>
          `
          : nothing}
        ${data.services?.length
          ? html`
            <inspector-section
              .title=${"Services"}
              .content=${html`
                <div class="flex flex-col gap-2.5">
                  ${data.services.map(serviceStatus)}
                </div>
              `}
            ></inspector-section>
          `
          : nothing}
        <inspector-section
          .title=${"Usage"}
          .content=${html`<metric-list .metrics=${data.usage}></metric-list>`}
          .first=${!data.folders?.length}
        ></inspector-section>
        <inspector-section
          .title=${"Tokens"}
          .content=${html`<metric-list .metrics=${data.tokens}></metric-list>`}
        ></inspector-section>
        ${data.servers?.length
          ? html`
            <inspector-section
              .title=${"Language servers"}
              .content=${html`
                <div class="flex flex-col gap-3">
                  ${data.servers.map(
                    (item) =>
                      html`<language-server-item .name=${item}></language-server-item>`,
                  )}
                  <p class="text-muted">0 errors · 1 warning</p>
                </div>
              `}
            ></inspector-section>
          `
          : nothing}
      </div>
    `;
  }
}

customElements.define("session-inspector", SessionInspectorElement);
