import type { Project } from "../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { icon } from "../primitives/icon.ts";

/** Static dropdown presentation; selection and filtering are supplied states. */
export class ProjectPickerElement extends DesignElement {
  static override properties = { projects: { attribute: false } };
  declare projects: Project[];

  constructor() {
    super();
    this.projects = [];
  }

  override render() {
    return html`<div
      class="w-80 overflow-hidden rounded-lg border border-line bg-surface text-dense text-ink shadow-menu"
      aria-label="Project picker"
    >
      <div class="flex items-center gap-2 border-b border-line px-3 py-3 text-muted">
        ${icon("magnifying-glass")}<span>Search projects…</span>
      </div>
      <div role="listbox" aria-label="Projects" class="max-h-96 overflow-y-auto p-1.5">
        <div
          role="option"
          aria-selected="true"
          class="flex items-center gap-2 rounded-control bg-action/10 px-2 py-2 text-action"
        >
          ${icon("folder")}<span class="flex-1">All projects</span>${icon("check")}
        </div>
        <div class="my-1 border-t border-line" role="presentation"></div>
        ${this.projects.map(
          (project) => html`<div
            role="option"
            aria-selected="false"
            class="flex min-w-0 items-start gap-2 rounded-control px-2 py-2"
          >
            <span class="mt-0.5 text-muted">${icon("folder")}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate" title=${project.name}>${project.name}</p>
              <p class="mt-0.5 truncate text-micro text-muted" title=${project.path}>
                ${project.path}
              </p>
            </div>
          </div>`,
        )}
      </div>
    </div>`;
  }
}

customElements.define("project-picker", ProjectPickerElement);
