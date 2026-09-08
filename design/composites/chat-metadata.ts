import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./branch-identity.ts";
import "./project-identity.ts";

export class ChatMetadataElement extends DesignElement {
  static override properties = {
    project: { type: String },
    branch: { type: String },
  };

  declare project: string;
  declare branch: string;

  constructor() {
    super();
    this.project = "";
    this.branch = "";
  }

  override render() {
    const { project, branch } = this;
    return html`
      <span class="flex min-w-0 items-center gap-1.5"
        ><project-identity .name=${project}></project-identity><span>·</span
        ><branch-identity .branch=${branch}></branch-identity
      ></span>
    `;
  }
}

customElements.define("chat-metadata", ChatMetadataElement);
