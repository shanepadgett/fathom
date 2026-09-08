import { html } from "lit";

import "./workspace-header.ts";

export const workspaceHeaderExamples = (["editor", "agent", "chat"] as const).map(
  (mode) => ({
    name: `${mode[0].toUpperCase()}${mode.slice(1)} focus`,
    markup: html`<workspace-header .mode=${mode}></workspace-header>`,
  }),
);
