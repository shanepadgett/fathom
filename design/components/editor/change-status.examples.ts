import { html } from "lit";

import { changeStatus } from "./change-status.ts";
import { diffStat } from "./diff-stat.ts";
import { statusDot } from "../../primitives/status-dot.ts";

export const changeStatusExamples = [
  {
    name: "Changes",
    markup: html`<div class="flex items-center gap-3">
      ${
      (["A", "M", "D", "R", "?"] as const).map(
        changeStatus,
      )
    }${diffStat(24, 8)}${statusDot("action", "Reviewing changes")}
    </div>`,
  },
];
