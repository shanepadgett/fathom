import { html } from "lit";
import { DesignElement } from "../../foundation/design-element.ts";
import {
  settingInput,
  settingRow,
  settingSelect,
  settingSwitch,
} from "./setting-controls.ts";

export class GeneralSettings extends DesignElement {
  override render() {
    return html`
      <div class="settings-content">
        <section
          aria-labelledby="appearance-title">
          <h2 id="appearance-title" class="settings-section-title">Appearance</h2>
          <div class="settings-section-card">
          ${settingRow(
            "Theme",
            "Choose how your workspace looks.",
            settingSelect(["System", "Light", "Dark"]),
          )}
          ${settingRow(
            "Interface density",
            "Set the spacing of lists and controls.",
            settingSelect(["Comfortable", "Compact"]),
          )}
          ${settingRow(
            "Reduce motion",
            "Keep transitions and animations to a minimum.",
            settingSwitch(),
          )}
          </div>
        </section>
        <section class="mt-8"
          aria-labelledby="workspace-title">
          <h2 id="workspace-title" class="settings-section-title">Workspace</h2>
          <div class="settings-section-card">
          ${settingRow(
            "Display name",
            "The name shown alongside your messages.",
            settingInput("Shane"),
          )}
          ${settingRow(
            "Default view",
            "Where new sessions begin.",
            settingSelect(["Agent", "Editor", "Chat"]),
          )}
          ${settingRow(
            "Restore last session",
            "Pick up where you left off when Fathom opens.",
            settingSwitch(true),
          )}
          </div>
        </section>
        <section class="mt-8"
          aria-labelledby="notifications-title">
          <h2 id="notifications-title"
            class="settings-section-title">Notifications</h2>
          <div class="settings-section-card">
          ${settingRow(
            "Desktop notifications",
            "Get notified when an agent needs your attention.",
            settingSwitch(true),
          )}
          ${settingRow(
            "Notification sounds",
            "Play a sound when a task finishes.",
            settingSwitch(),
          )}
          </div>
        </section>
      </div>
    `;
  }
}
customElements.define("general-settings", GeneralSettings);
