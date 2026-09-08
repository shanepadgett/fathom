import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./project-picker.ts";

export const projectPickerExamples = [
  {
    name: "Projects",
    markup: html`<project-picker .projects=${scenario.projects}></project-picker>`,
  },
];
