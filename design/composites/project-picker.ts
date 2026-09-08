import type { Project } from "../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { emptyState } from "../primitives/empty-state.ts";
import { searchFieldPreview } from "../primitives/search-field-preview.ts";
import "./project-search-result.ts";
import "./search-surface.ts";

export class ProjectPickerElement extends DesignElement {
  static override properties = { projects: { attribute: false } };
  declare projects: Project[];

  constructor() {
    super();
    this.projects = [];
  }

  override render() {
    const { projects } = this;
    return html`
      <search-surface
        .label=${"Choose a project"}
        .heading=${"Projects"}
        .field=${searchFieldPreview("Search projects\u2026")}
        .results=${
          projects.length
            ? projects.map(
                (project, index) => html`
                  <project-search-result
                    .project=${project}
                    .shortcut=${`⌘${index + 1}`}
                    .selected=${index === 0}
                  ></project-search-result>
                `,
              )
            : emptyState("No projects found")
        }
        .action=${"Select"}
      ></search-surface>
    `;
  }
}

customElements.define("project-picker", ProjectPickerElement);
