import { html } from "lit";

import { type Tone, tones } from "../../primitives/tone.ts";

export type GitStatus = "A" | "M" | "D" | "R" | "?";

const gitStatuses: Record<GitStatus, [string, Tone]> = {
  A: ["Added", "success"],
  M: ["Modified", "action"],
  D: ["Deleted", "danger"],
  R: ["Renamed", "action"],
  "?": ["Untracked", "neutral"],
};

export const changeStatus = (status?: GitStatus) =>
  status
    ? html`
      <span
        class="shrink-0 text-micro ${tones[gitStatuses[status][1]]}"
        aria-label="${gitStatuses[status][0]}"
      >${status}</span>
    `
    : "";
