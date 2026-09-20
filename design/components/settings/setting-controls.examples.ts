import { html } from "lit";
import {
  settingInput,
  settingRow,
  settingSelect,
  settingSwitch,
} from "./setting-controls.ts";

export const settingControlExamples = [{
  name: "Preference controls",
  markup: html`<div class="max-w-[48rem]">
    ${
    settingRow(
      "Enabled switch",
      "A binary preference in its on state.",
      settingSwitch(true),
    )
  }
    ${
    settingRow(
      "Off switch",
      "A binary preference in its off state.",
      settingSwitch(),
    )
  }
    ${
    settingRow(
      "Selection",
      "Choose one option from a list.",
      settingSelect(["System", "Light", "Dark"]),
    )
  }
    ${
    settingRow(
      "Text field",
      "Enter a workspace preference.",
      settingInput("My workspace"),
    )
  }
  </div>`,
}];
