import { html } from "lit";

import { scenario } from "../../fixtures/workspace-scenario.ts";
import "./file-tree.ts";

export const fileTreeExamples = [
  {
    name: "Tree",
    markup: html`
      <div class="w-files-sidebar bg-surface">
        <file-tree
          .nodes=${scenario.files}
          .selected=${scenario.selectedFile}
          .expanded=${scenario.expandedFolders}
        ></file-tree>
      </div>
    `,
  },
];
