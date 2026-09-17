import type { Project } from "../../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { searchFieldPreview } from "../../primitives/search-field-preview.ts";
import "./project-search-result.ts";
import "./search-surface.ts";

/** Static project selection before starting a session. */
export class NewSessionElement extends DesignElement {
  static override properties = { projects: { attribute: false } };
  declare projects: Project[];

  constructor() {
    super();
    this.projects = [];
  }

  override render() {
    return html`
      <div role="dialog" aria-modal="true" aria-label="New session">
        <search-surface
          label="New session"
          heading="New session · Choose a project"
          .field=${searchFieldPreview("Search projects…")}
          .results=${this.projects.map(
            (project, index) => html`
              <project-search-result
                .project=${project}
                .shortcut=${`⌘${index + 1}`}
                .selected=${index === 0}
              ></project-search-result>
            `,
          )}
          action="Start session"
        ></search-surface>
      </div>
    `;
  }
}

customElements.define("new-session", NewSessionElement);
