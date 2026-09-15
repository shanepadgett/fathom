import { html } from "lit";

import { button } from "./button.ts";
import { icon } from "./icon.ts";

export const selectorButton = (value: string, secondary = "") =>
  button({
    label: secondary ? `${value}, ${secondary}` : value,
    content: html`
      <span
      >${value}${secondary
        ? html`
          <span class="text-muted">${" · "}${secondary}</span>
        `
        : ""}</span>${icon("caret-down", "small")}
    `,
  });
