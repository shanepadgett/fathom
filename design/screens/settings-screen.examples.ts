import { html } from "lit";
import type { DesignEntry } from "../site/design-entry.ts";
import "./SettingsScreen.ts";

export const settingsScreens: DesignEntry[] = [
  {
    id: "settings-device-flow",
    name: "Settings · Device code",
    description:
      "Device authorization and API key options for an illustrative provider.",
    examples: [{
      name: "Device code sign-in",
      markup:
        html`<settings-screen section="providers" provider="device-demo"></settings-screen>`,
    }],
  },
  {
    id: "settings-general",
    name: "Settings · General",
    description:
      "Workspace preferences with shared switches, dropdowns, and input fields.",
    examples: [{
      name: "General settings",
      markup: html`<settings-screen></settings-screen>`,
    }],
  },
  {
    id: "settings-providers",
    name: "Settings · Providers",
    description:
      "Provider navigation with account sign-in and API key connection methods.",
    examples: [{
      name: "Provider settings",
      markup: html`<settings-screen section="providers"></settings-screen>`,
    }],
  },
];
