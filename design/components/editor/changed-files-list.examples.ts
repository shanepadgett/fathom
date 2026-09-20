import { html } from "lit";

import { scenario } from "../../fixtures/workspace-scenario.ts";
import "./changed-files-list.ts";

export const changedFilesListExamples = [
  {
    name: "Changes",
    markup: html`
      <div class="w-files-sidebar bg-surface">
        <changed-files-list
          .files=${scenario.changedFiles}
          .selected=${scenario.selectedFile}
          .changes=${scenario.changes}
        ></changed-files-list>
      </div>
    `,
  },
];
