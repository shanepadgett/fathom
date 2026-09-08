import { html } from "lit";

import { pinnedProjects } from "../fixtures/pinned-sessions.ts";
import "./project-picker.ts";
import "./new-session.ts";

export const projectPickerExamples = [
  {
    name: "Project dropdown · Open",
    markup: html`<project-picker .projects=${pinnedProjects}></project-picker>`,
  },
  {
    name: "New session · Project selection modal",
    markup: html`<new-session .projects=${pinnedProjects}></new-session>`,
  },
];
