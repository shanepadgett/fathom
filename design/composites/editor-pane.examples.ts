import { html } from "lit";

import { codeLines } from "../fixtures/code.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "./editor-pane.ts";

export const editorPaneExamples = [
  {
    name: "Editor",
    markup: html`
      <div class="flex h-viewer-workspace-preview">
        <editor-pane
          .files=${[scenario.changedFiles[0], scenario.changedFiles[2]]}
          .selected=${scenario.selectedFile}
          .path=${scenario.path}
          .lines=${codeLines}
        ></editor-pane>
      </div>
    `,
  },
];
