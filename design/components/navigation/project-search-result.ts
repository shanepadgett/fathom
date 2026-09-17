import type { Project } from "../../models/session.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import { resultFrame } from "./search-result-frame.ts";

export class ProjectSearchResultElement extends DesignElement {
  static override properties = {
    project: { attribute: false },
    shortcut: { type: String },
    selected: { type: Boolean },
  };

  declare project: Project;
  declare shortcut: string;
  declare selected: boolean;

  constructor() {
    super();
    this.shortcut = "";
    this.selected = false;
  }

  override render() {
    if (!this.project) {
      return nothing;
    }
    const { project, shortcut, selected } = this;
    return resultFrame(
      html`<span class="text-muted">${icon("folder", "large")}</span>`,
      html`
        <p class="truncate text-sm">${project.name}</p>
        <p class="mt-0.5 truncate text-xs text-muted">Local · ${project.path}</p>
      `,
      shortcut,
      selected,
    );
  }
}

customElements.define("project-search-result", ProjectSearchResultElement);
