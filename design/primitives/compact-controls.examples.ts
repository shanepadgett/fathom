import { html } from "lit";

import { button } from "./button.ts";
import { iconButton } from "./icon-button.ts";
import { selectorButton } from "./selector-button.ts";

export const buttonExamples = [
  {
    name: "Controls",
    markup: html`
      <div class="flex flex-wrap items-center gap-3">
        ${button({
          label: "Action",
        })}${iconButton("note-pencil", "New chat")}${selectorButton(
          "Claude Sonnet",
          "Medium",
        )}${button({ label: "Unavailable", disabled: true })}
      </div>
    `,
  },
];
