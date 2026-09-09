import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { branchIdentity } from "./branch-identity.ts";
import { projectIdentity } from "./project-identity.ts";

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
      <span class="flex min-w-0 items-center gap-1.5">
        ${projectIdentity(project)}<span>·</span>${branchIdentity(branch)}
      </span>
    `;
  }
}

customElements.define("chat-metadata", ChatMetadataElement);
