import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

export class BranchIdentityElement extends DesignElement {
  static override properties = { branch: { type: String } };
  declare branch: string;

  constructor() {
    super();
    this.branch = "";
  }

  override render() {
    const { branch } = this;
    return html`
      <span class="flex min-w-0 items-center gap-1.5"
        >${icon("git-branch")}<span class="truncate" title=${branch}>${branch}</span></span
      >
    `;
  }
}

customElements.define("branch-identity", BranchIdentityElement);
